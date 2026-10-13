/** Only exact server/RPC failures are classified; never expose database messages. */
export class LedgerFailure extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message); this.code = code; this.status = status;
  }
}
export function ledgerRpcFailure(error: { code?: string; message?: string }): LedgerFailure {
  const unknown = new LedgerFailure("LEDGER_OUTCOME_UNKNOWN", "寫入結果未確認；核對流水後只能用原識別碼重試", 503);
  if (error.code !== "P0001") return unknown;
  switch (error.message) {
    case "order changed; reload before recording":
    case "payment source changed; reload before recording":
      return new LedgerFailure("LEDGER_SOURCE_CHANGED", "訂單或報酬資料已變更，本次未寫入；請核對最新資料", 409);
    case "idempotency key reused with different event":
    case "idempotency key reused with different sitter payment":
      return new LedgerFailure("LEDGER_KEY_CONFLICT", "識別碼已對應不同內容；請交管理者核對，不可另建同筆付款", 409);
    case "invalid financial entry": case "invalid financial amount": case "invalid sitter payment":
    case "difference reason required (including partial payment)":
    case "platform entry requires a platform order":
      return new LedgerFailure("LEDGER_REJECTED", "本次未寫入；請核對金額、付款途徑與差異原因", 422);
    case "ledger write denied": case "sitter payment write denied":
      return new LedgerFailure("LEDGER_DENIED", "沒有記錄這筆付款的權限", 403);
    case "historical payment source changed; settlement review required":
    case "payment source requires settlement review":
    case "order snapshot does not reconcile":
      return new LedgerFailure("LEDGER_REVIEW_REQUIRED", "付款來源或歷史報酬需要核對；本次未寫入，不自動調整", 409);
    default: return unknown;
  }
}

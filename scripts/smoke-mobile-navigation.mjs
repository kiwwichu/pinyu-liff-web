import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const profile = await mkdtemp(resolve(tmpdir(), "pinyu-nav-smoke-"));
const screenshots = await mkdtemp(resolve(tmpdir(), "pinyu-nav-evidence-"));
const assets = new Set(["index.html", "app.js", "style.css", "mobile-navigation.js", "availability-core.js", "order-v2-ui.js", "order-ledger-ui.js", "sitter-finance-ui.js", "finance-report-ui.js"]);
const server = createServer(async (req, res) => {
  try {
    const file = new URL(req.url, "http://localhost").pathname.replace(/^\/admin\//, "") || "index.html";
    if (file === "config.js") return res.writeHead(200, {"Content-Type":"text/javascript"}).end('window.ADMIN_CONFIG={LIFF_ID:"synthetic",API_URL:"/api/admin",PORTAL_API:"/api/portal"}');
    if (!assets.has(file)) return res.writeHead(404).end();
    let body = await readFile(resolve(root, "admin", file), "utf8");
    if (file === "index.html") body = body.replace(/<script src="https:\/\/static.line-scdn.net[^>]+><\/script>/, "");
    res.writeHead(200, {"Content-Type": file.endsWith(".js") ? "text/javascript; charset=utf-8" : file.endsWith(".css") ? "text/css" : "text/html; charset=utf-8"}).end(body);
  } catch { res.writeHead(500).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--no-sandbox", "--in-process-gpu", "--disable-gpu", "--disable-gpu-sandbox",
  "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"
], {stdio:"ignore", windowsHide:true});
const delay = ms => new Promise(done => setTimeout(done, ms));
let socket;
try {
  let port;
  for(let i=0;i<100;i++) { try { port=(await readFile(resolve(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]; break; } catch { await delay(100); } }
  assert.ok(port, "Chrome started");
  const target = await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"}).then(r=>r.json());
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done,reject)=>{socket.addEventListener("open",done,{once:true});socket.addEventListener("error",reject,{once:true});});
  let id=0;
  const pending=new Map(), exceptions=[];
  socket.addEventListener("message",event=>{
    const r=JSON.parse(event.data), task=pending.get(r.id);
    if(task){pending.delete(r.id);clearTimeout(task.timer);r.error?task.reject(new Error(r.error.message)):task.done(r.result);}
    if(r.method==="Runtime.exceptionThrown")exceptions.push(r.params.exceptionDetails);
  });
  const send=(method,params={})=>new Promise((done,reject)=>{
    const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(new Error("CDP timeout "+method));},20000);
    pending.set(requestId,{done,reject,timer});socket.send(JSON.stringify({id:requestId,method,params}));
  });
  const evaluate=async expression=>{
    const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs",{urls:["https://*"]});
  await send("Page.addScriptToEvaluateOnNewDocument",{source:`
    window.liff={init:async()=>{},isLoggedIn:()=>true,getAccessToken:()=>"synthetic"};
    window.__permissions={canViewMoney:true,canManageSitters:true,canManageHomeVisits:true,canEditOrders:true,canCreateOrders:true};
    window.__apiCalls=[];window.__unexpectedNetwork=0;
    window.fetch=async(url,options={})=>{
      const path=String(url),body=JSON.parse(options.body||"{}");window.__apiCalls.push(body.operation||path);
      const json=data=>new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
      if(path==="/api/portal")return json({success:true,role:"OWNER"});
      if(path!=="/api/admin"){window.__unexpectedNetwork++;throw new Error("External fetch blocked");}
      if(body.operation==="bootstrap")return json({success:true,user:{displayName:"Synthetic Admin",role:"OWNER"},permissions:window.__permissions,
        summary:{},orders:[],ordersV2:[],families:[],pets:[],servicePlans:[],servicePresets:[],reviews:[],sitters:[]});
      throw new Error("Unexpected API operation: "+body.operation);
    };
  `});
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/admin/index.html"});
  await delay(400);
  for(let i=0;i<100;i++){if(await evaluate('document.getElementById("openMobileMenu")?.disabled === false'))break;await delay(50);}
  assert.equal(await evaluate('document.getElementById("openMobileMenu")?.disabled === false'),true,JSON.stringify({exceptions,boot:await evaluate('({calls:window.__apiCalls,text:document.getElementById("app")?.textContent})')}));
  for(const width of [320,375,390,430,768]){
    await send("Emulation.setDeviceMetricsOverride",{width,height:844,deviceScaleFactor:1,mobile:true});
    const checks=await evaluate(`(async()=>{
      const wait=()=>new Promise(r=>setTimeout(r,120));
      const trigger=document.getElementById("openMobileMenu"),menu=document.getElementById("mobileMenu");
      const bottom=[...document.querySelectorAll(".bottom-nav button")];
      const four=bottom.map(b=>b.dataset.page).join(",")==="dashboard,orders,create,families";
      const touch=bottom.every(b=>b.getBoundingClientRect().width>=44&&b.getBoundingClientRect().height>=44);
      let reachable=true;
      for(const b of bottom){b.click();await wait();reachable&&=b.classList.contains("active")&&document.getElementById("app").textContent.length>0&&document.documentElement.scrollWidth<=innerWidth;}
      trigger.click();await wait();
      const opened=menu.open&&document.activeElement.id==="closeMobileMenu"&&document.body.style.position==="fixed";
      const targets=[...menu.querySelectorAll("[data-mobile-page]")].filter(b=>!b.hidden);
      const inactive=[...menu.querySelectorAll("button:disabled")].map(b=>b.textContent);
      const unavailable=inactive.some(t=>t.includes("通知紀錄"))&&inactive.some(t=>t.includes("系統管理"));
      let routes=true;
      for(const b of targets){if(!menu.open){trigger.click();await wait();}b.click();await wait();routes&&=!menu.open&&document.body.style.position===""&&document.getElementById("app").textContent.length>0&&document.documentElement.scrollWidth<=innerWidth;}
      trigger.click();await wait();history.back();await wait();
      const back=!menu.open&&trigger.getAttribute("aria-expanded")==="false"&&document.body.style.position==="";
      trigger.click();await wait();
      document.getElementById("closeMobileMenu").click();await wait();
      const close=!menu.open&&document.activeElement===trigger;
      const noOverflow=document.documentElement.scrollWidth<=innerWidth;
      return {four,touch,reachable,opened,unavailable,routes,back,close,noOverflow};
    })()`);
    for(const [key,value]of Object.entries(checks))assert.equal(value,true,width+" "+key);
    console.log(JSON.stringify({mobileNavigation:"PASS",width,...checks}));
  }
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('document.getElementById("openMobileMenu").click()');
  const drawerImage=await send("Page.captureScreenshot",{format:"png"});
  await writeFile(resolve(screenshots,"drawer-390.png"),Buffer.from(drawerImage.data,"base64"));
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
  await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
  await delay(150);
  assert.equal(await evaluate('!document.getElementById("mobileMenu").open && document.body.style.position===""'),true,"real Escape");
  await evaluate('document.getElementById("openMobileMenu").click()');
  await send("Input.dispatchMouseEvent",{type:"mousePressed",x:380,y:400,button:"left",clickCount:1});
  await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:380,y:400,button:"left",clickCount:1});
  await delay(150);
  assert.equal(await evaluate('!document.getElementById("mobileMenu").open'),true,"backdrop");
  await evaluate('document.getElementById("openMobileMenu").click()');
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9,modifiers:8});
  await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9,modifiers:8});
  assert.equal(await evaluate('document.getElementById("mobileMenu").contains(document.activeElement)'),true,"focus stays inside");
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await delay(150);
  assert.equal(await evaluate('!document.getElementById("mobileMenu").open && document.body.style.position==="" && getComputedStyle(document.querySelector(".sidebar")).display!=="none" && getComputedStyle(document.querySelector(".bottom-nav")).display==="none"'),true,"desktop resize unlock");
  assert.equal(await evaluate(`(()=>{
    const pages=["dashboard","orders","create","families","sitters","reviews","finance","profile","services"];
    return pages.every(page=>{const b=document.querySelector('.sidebar [data-page="'+page+'"]');b.click();return b.classList.contains("active")&&document.getElementById("app").textContent.length>0;});
  })()`),true,"desktop all existing routes");
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('window.__permissions={}; document.getElementById("btnRefresh").click()');
  await delay(200);
  assert.equal(await evaluate(`[...document.querySelectorAll("[data-mobile-permission]")].every(b=>b.hidden) && document.querySelector('.bottom-nav [data-page="create"]').disabled`),true,"permission refresh");
  assert.equal(await evaluate('window.__unexpectedNetwork'),0);
  for(const width of [390,1440]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width===390});
    const detail=await evaluate(`(async()=>{
      const {createOrderV2Ui}=await import('/admin/order-v2-ui.js');
      const dialog=document.getElementById('orderDialog'),content=document.getElementById('dialogContent');
      const state={permissions:{canViewMoney:true,canEditOrders:true},sitters:[],pets:[],families:[]};
      const money={serviceSubtotal:1000,travelFeeTotal:0,homeVisitFeeTotal:0,tipTotal:0,discountAmount:0,customerTotal:1000,depositAmountDue:0,balanceAmountDue:1000,sitterEarningsTotal:800,ownerEarningsTotal:0,companyEarningsBeforePlatform:200};
      const ui=createOrderV2Ui({state,app:document.getElementById('app'),dialog,dialogContent:content,escapeHtml:x=>String(x??''),formatMoney:String,navigate:()=>{},showToast:message=>{throw new Error(message)},requestApi:async()=>({order:{...money,orderId:'synthetic-order',orderNumber:'SYNTHETIC',ownerName:'Synthetic family',petName:'Synthetic pet',familyId:'synthetic-family',orderStatus:'draft',paymentStatus:'unpaid',notes:'Synthetic note'},items:[{itemType:'service',itemName:'Synthetic service',serviceDate:'2026-09-29',quantity:1,lineAmount:1000}],homeVisitIds:['synthetic-visit']})});
      await ui.open('synthetic-order');
      const details=content.querySelector('.internal-finance-details');
      const sectionOrder=[...content.children].map(el=>el.textContent);
      return {open:details.open,internalRows:details.querySelectorAll('.formula-rows > div').length,service:content.textContent.includes('Synthetic service'),ledgerBeforeHome:sectionOrder.findIndex(t=>t.includes('載入'))<sectionOrder.findIndex(t=>t.includes('相關家訪')),noOverflow:dialog.scrollWidth<=dialog.clientWidth};
    })()`);
    console.log(JSON.stringify({width,detail}));
    assert.equal(detail.open,width===1440,'internal default');assert.equal(detail.internalRows,3);assert.equal(detail.service,true);
    if(width===390) assert.equal(detail.ledgerBeforeHome,true,'payment before secondary home visit');
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(resolve(screenshots,'order-'+width+'.png'),Buffer.from(shot.data,'base64'));
    console.log(JSON.stringify({screenshots}));
    assert.equal(detail.noOverflow,true,'order dialog overflow');
    await evaluate('document.getElementById("orderDialog").close()');
  }
  assert.deepEqual(exceptions,[]);
  console.log(JSON.stringify({screenshots,orderDetailHierarchy:'PASS'}));
  console.log(JSON.stringify({escape:true,backdrop:true,focus:true,desktop:true,permissionRefresh:true,externalFetches:0}));
} finally {
  socket?.close();
  const stopped=new Promise(done=>{if(chrome.exitCode!==null)done();else chrome.once("exit",done);});
  chrome.kill();await Promise.race([stopped,delay(3000)]);server.close();
  const target=resolve(profile),tempRoot=resolve(tmpdir())+sep;
  if(!target.startsWith(tempRoot)||!target.slice(tempRoot.length).startsWith("pinyu-nav-smoke-"))throw new Error("Unsafe cleanup");
  await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

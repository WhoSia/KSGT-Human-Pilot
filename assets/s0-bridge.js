(()=>{"use strict";
const C=window.KSGT_CONFIG||{};
const Assignment=window.KSGT_S0_ASSIGNMENT;
const qs=new URLSearchParams(location.search);
const nativeFetch=window.fetch.bind(window);
const nativeGetRandomValues=crypto.getRandomValues.bind(crypto);
const bankUrl=new URL(C.itemSource,location.href).href;
const rawBlock=qs.get("b");
const rawCohort=qs.get("c");
const requestedBlock=rawBlock===null?null:Number(rawBlock);
const requestedCohort=rawCohort===null?null:Number(rawCohort);
const scheduled=requestedBlock!==null&&requestedCohort!==null&&Number.isInteger(requestedBlock)&&requestedBlock>=0&&requestedBlock<=1&&Number.isInteger(requestedCohort)&&requestedCohort>=0&&requestedCohort<=11;
const randomWord=new Uint32Array(1);nativeGetRandomValues(randomWord);
const block=scheduled?requestedBlock:(randomWord[0]&1);
const cohort=scheduled?requestedCohort:(randomWord[0]%12);
const slot=qs.get("slot")||null;
const forcedSeed=block===0?1116:1117;
let seedInjected=false;
let bank=null;
let bankSha256=null;
let selected=[];
let meta=null;

const sha256=async text=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};
const itemMap=()=>new Map((bank?.items||[]).map(x=>[x.item_id,x]));
const enrichPayload=payload=>{
  if(!payload||typeof payload!=="object")return payload;
  payload.study_phase=C.studyPhase;
  payload.assignment_metadata={...meta,bank_sha256:bankSha256};
  const map=itemMap();
  if(Array.isArray(payload.responses))payload.responses=payload.responses.map(r=>{const item=map.get(r.item_id)||{};return {...r,bank_id:meta?.bank_id||null,bank_sha256:bankSha256,assignment_protocol_version:meta?.protocol_version||null,assignment_block:meta?.assignment_block??null,assignment_cohort:meta?.assignment_cohort??null,assignment_slot:meta?.assignment_slot||null,assignment_source:meta?.assignment_source||null,assignment_stratum:item.assignment_stratum||null,priority_rank:item.priority_rank??null,constructs:Array.isArray(item.constructs)?item.constructs:[],item_question:item.question||null}});
  return payload;
};

crypto.getRandomValues=function(array){
  if(!seedInjected&&array instanceof Uint32Array&&array.length===1){array[0]=forcedSeed;seedInjected=true;return array}
  return nativeGetRandomValues(array);
};

const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  try{const obj=JSON.parse(value);if(obj&&obj.schema_version==="ksgt.human-pilot-response.v2"&&Array.isArray(obj.responses))value=JSON.stringify(enrichPayload(obj))}catch{}
  return nativeSetItem.call(this,key,value);
};

window.fetch=async function(input,init){
  const url=new URL(typeof input==="string"?input:input.url,location.href).href;
  if(url===bankUrl){
    if(C.requireScheduledAssignment&&!scheduled)throw new Error("연구자에게 받은 전용 링크로 접속해 주세요.");
    const response=await nativeFetch(input,init);
    if(!response.ok)return response;
    const raw=await response.text();
    bank=JSON.parse(raw);
    Assignment.validateBank(bank);
    bankSha256=await sha256(raw);
    const result=Assignment.assign(bank,{seed:forcedSeed,block,cohort,slot});
    selected=bank.assignment_protocol.strata_order.map(stratum=>{
      const x=result.assignment.find(y=>y.assignment_stratum===stratum);
      const item=bank.items.find(y=>y.item_id===x.item_id);
      return {item_id:item.item_id,variant_a_text:item.variant_a_text,variant_b_text:item.variant_b_text};
    });
    meta=result.meta;
    return new Response(JSON.stringify(selected),{status:200,headers:{"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store"}});
  }
  if(C.collectorUrl&&url===new URL(C.collectorUrl,location.href).href&&init?.body){
    try{
      const body=JSON.parse(init.body);
      if(body.action==="start")Object.assign(body,{study_phase:C.studyPhase,bank_id:meta?.bank_id||null,assignment_protocol_version:meta?.protocol_version||null,assignment_block:meta?.assignment_block??null,assignment_cohort:meta?.assignment_cohort??null,assignment_slot:meta?.assignment_slot||null});
      if(body.action==="submit"&&body.payload)body.payload=enrichPayload(body.payload);
      init={...init,body:JSON.stringify(body)};
    }catch{}
  }
  return nativeFetch(input,init);
};

window.KSGT_S0_RUNTIME={getMeta:()=>meta?{...meta,bank_sha256:bankSha256}:null,getSelection:()=>selected.map(x=>({...x}))};

const postCollector=async body=>{
  const r=await nativeFetch(C.collectorUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"});
  let d;
  try{d=await r.json()}catch{throw new Error("수집 서버가 JSON으로 응답하지 않았습니다.")}
  if(!r.ok||d.ok===false)throw new Error(d.error||`request_failed_${r.status}`);
  return d;
};

const installDeleteRecovery=()=>{
  const button=document.getElementById("deleteButton");
  const status=document.getElementById("deleteStatus");
  if(!button||!status)return;
  button.onclick=async()=>{
    const storageKey=`${C.storagePrefix||"ksgt"}:state`;
    const payloadKey=`${C.storagePrefix||"ksgt"}:last-payload`;
    try{
      const state=JSON.parse(localStorage.getItem(storageKey)||"{}");
      if(!state.receipt?.response_id||!state.deletionProof)throw new Error("delete_state_missing");
      const deleteWith=proof=>postCollector({action:"delete",study_id:C.studyId,response_id:state.receipt.response_id,deletion_proof:proof});
      let result;
      try{
        result=await deleteWith(state.deletionProof);
      }catch(e){
        if(e.message!=="delete_authorization_failed")throw e;
        const payload=JSON.parse(localStorage.getItem(payloadKey)||"null");
        if(!payload)throw new Error("delete_recovery_payload_missing");
        const replay=await postCollector({action:"submit",payload});
        if(!replay?.receipt||replay.receipt.response_id!==state.receipt.response_id||replay.receipt.receipt_hash!==state.receipt.receipt_hash)throw new Error("delete_recovery_receipt_mismatch");
        state.receipt=replay.receipt;
        state.deletionProof=replay.receipt.deletion_proof;
        localStorage.setItem(storageKey,JSON.stringify(state));
        result=await deleteWith(state.deletionProof);
      }
      state.deleted=true;
      localStorage.setItem(storageKey,JSON.stringify(state));
      status.textContent=`삭제 완료 · ${result.deletion_receipt}`;
    }catch(e){
      status.textContent=`삭제하지 못했습니다: ${e.message}`;
    }
  };
};

document.addEventListener("DOMContentLoaded",installDeleteRecovery);
})();

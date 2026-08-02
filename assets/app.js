(()=>{"use strict";
const C=window.KSGT_CONFIG||{};
const $=id=>document.getElementById(id);
const qs=new URLSearchParams(location.search);
const invitationToken=qs.get("invite")||"";
const storageKey=`${C.storagePrefix||"ksgt"}:state`;
const payloadKey=`${C.storagePrefix||"ksgt"}:last-payload`;
const initialState=()=>({sessionId:null,assignment:[],index:0,responses:[],receipt:null,deletionProof:null,startedAt:null,itemStartedAt:null,pasteEvents:0,pastedCharacters:0,inputEvents:0,current:null,deleted:false,consentAttestation:null});
let state=initialState();
let termsOpenedAt=null;
let termsReadAt=null;
let participantAcceptedAt=null;
let guardianAcceptedAt=null;

const configured=()=>Boolean(C.collectorUrl&&!C.collectorUrl.includes("PASTE_")&&C.contact&&!C.contact.includes("PASTE_"));
const isPilot=()=>C.launchMode==="pilot";
const sourceContract=()=>isPilot()?{source_partition:"human",actor_type:"human_participant",human_evidence:true,external_human_evidence:true}:{source_partition:"internal_owner",actor_type:"internal_owner_tester",human_evidence:false,external_human_evidence:false};
const eligibilityBasis=()=>document.querySelector('input[name="eligibility"]:checked')?.value||null;
const minorSelected=()=>eligibilityBasis()==="minor_guardian_consent_attested";
const currentInput=()=>({left:$("leftImpression")?.value||"",right:$("rightImpression")?.value||"",comparison:$("comparison")?.value||"",meaningRelation:document.querySelector('input[name="meaningRelation"]:checked')?.value||null,preference:document.querySelector('input[name="preference"]:checked')?.value||null});
const save=()=>{state.current=currentInput();localStorage.setItem(storageKey,JSON.stringify(state));if($("saveState"))$("saveState").textContent="이 기기에 임시 저장됨"};
const api=async body=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(C.collectorUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow",signal:controller.signal});let d;try{d=await r.json()}catch{throw new Error("수집 서버가 JSON으로 응답하지 않았습니다.")}if(!r.ok||d.ok===false)throw new Error(d.error||`request_failed_${r.status}`);return d}finally{clearTimeout(timer)}};
const hashText=async text=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};
const shuffle=(a,seed)=>{let x=seed>>>0;const rand=()=>((x=(1664525*x+1013904223)>>>0)/4294967296);const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const canonicalPreference=(displayPreference,order)=>{if(!["left","right"].includes(displayPreference))return displayPreference;if(order==="AB")return displayPreference==="left"?"A":"B";return displayPreference==="left"?"B":"A"};
const clearInputs=()=>{$("leftImpression").value="";$("rightImpression").value="";$("comparison").value="";document.querySelectorAll('input[name="meaningRelation"],input[name="preference"]').forEach(x=>x.checked=false);$("choicePanel").hidden=true;$("nextItem").disabled=true;["leftCount","rightCount","comparisonCount"].forEach(id=>$(id).textContent="0")};
const hydrateInputs=current=>{if(!current)return;$("leftImpression").value=current.left||"";$("rightImpression").value=current.right||"";$("comparison").value=current.comparison||"";if(current.meaningRelation){const x=document.querySelector(`input[name="meaningRelation"][value="${CSS.escape(current.meaningRelation)}"]`);if(x)x.checked=true}if(current.preference){const x=document.querySelector(`input[name="preference"][value="${CSS.escape(current.preference)}"]`);if(x)x.checked=true}$("leftCount").textContent=String($("leftImpression").value.length);$("rightCount").textContent=String($("rightImpression").value.length);$("comparisonCount").textContent=String($("comparison").value.length);if(current.meaningRelation||current.preference)$("choicePanel").hidden=false;updateNextEnabled()};
const showItem=(restoreCurrent=false)=>{const p=state.assignment[state.index];clearInputs();$("leftText").textContent=p.left_text;$("rightText").textContent=p.right_text;$("progressText").textContent=`문항 ${state.index+1}`;$("progressCount").textContent=`${state.index+1} / ${state.assignment.length}`;$("progressBar").max=state.assignment.length;$("progressBar").value=state.index;if(!restoreCurrent){state.itemStartedAt=new Date().toISOString();state.current=null}else hydrateInputs(state.current);save();window.scrollTo({top:0,behavior:"smooth"})};
const currentRecord=async()=>{const p=state.assignment[state.index];const meaningRelation=document.querySelector('input[name="meaningRelation"]:checked')?.value||null;const displayPreference=document.querySelector('input[name="preference"]:checked')?.value||null;return {response_id:crypto.randomUUID(),item_id:p.item_id,presentation_order:p.presentation_order,display_left_variant:p.display_left_variant,display_right_variant:p.display_right_variant,impression_left:$("leftImpression").value,impression_right:$("rightImpression").value,comparison:$("comparison").value,meaning_relation:meaningRelation,display_preference:displayPreference,canonical_preference:canonicalPreference(displayPreference,p.presentation_order),item_started_at_utc:state.itemStartedAt,item_finished_at_utc:new Date().toISOString(),paste_events:state.pasteEvents,pasted_characters:state.pastedCharacters,input_events:state.inputEvents,text_sha256:await hashText([$("leftImpression").value,$("rightImpression").value,$("comparison").value].join("\n---\n"))}};
const loadItems=async()=>{const r=await fetch(C.itemSource,{cache:"no-store"});if(!r.ok)throw new Error("문항 파일을 불러오지 못했습니다.");const items=await r.json();if(!Array.isArray(items)||items.length<1)throw new Error("문항 파일이 비어 있습니다.");return items};
const assignLocal=async()=>{const items=await loadItems();const seed=crypto.getRandomValues(new Uint32Array(1))[0];const picked=shuffle(items,seed).slice(0,Math.min(C.assignmentCount||3,items.length));return picked.map((x,i)=>{const reverse=((seed+i)%2)===1;return reverse?{item_id:x.item_id,left_text:x.variant_b_text,right_text:x.variant_a_text,presentation_order:"BA",display_left_variant:"B",display_right_variant:"A"}:{item_id:x.item_id,left_text:x.variant_a_text,right_text:x.variant_b_text,presentation_order:"AB",display_left_variant:"A",display_right_variant:"B"}})};

const updateStart=()=>{
  const basis=eligibilityBasis();
  const eligibilityOk=basis==="adult_self_consent"||(basis==="minor_guardian_consent_attested"&&$("guardianConfirm").checked);
  $("start").disabled=!(termsReadAt&&$("consent").checked&&eligibilityOk);
};
const updateNextEnabled=()=>{$("nextItem").disabled=!(document.querySelector('input[name="meaningRelation"]:checked')&&document.querySelector('input[name="preference"]:checked'))};
const makeConsentAttestation=()=>({
  consent_version:C.consentVersion,
  consent_ui_revision:"terms-dialog-guardian-r1",
  eligibility_basis:eligibilityBasis(),
  terms_opened_at_utc:termsOpenedAt,
  terms_read_at_utc:termsReadAt,
  participant_consent_attested:true,
  participant_consent_at_utc:participantAcceptedAt||new Date().toISOString(),
  guardian_consent_attested:minorSelected()?$("guardianConfirm").checked:false,
  guardian_consent_at_utc:minorSelected()?(guardianAcceptedAt||new Date().toISOString()):null
});
const startFresh=async()=>{
  if(C.requireInvitation&&!invitationToken)throw new Error("초대 링크가 필요합니다.");
  const basis=eligibilityBasis();
  if(!termsReadAt||!$("consent").checked)throw new Error("연구 참여 설명을 확인하고 동의해 주세요.");
  if(!basis)throw new Error("연령 및 동의 방식을 선택해 주세요.");
  if(basis==="minor_guardian_consent_attested"&&!$("guardianConfirm").checked)throw new Error("미성년 참여자는 보호자 확인이 필요합니다.");
  state=initialState();
  state.sessionId=crypto.randomUUID();
  state.startedAt=new Date().toISOString();
  state.consentAttestation=makeConsentAttestation();
  state.assignment=await assignLocal();
  if(configured()){
    const response=await api({action:"start",study_id:C.studyId,session_id:state.sessionId,invitation_token:invitationToken,consent_version:C.consentVersion,client_version:C.clientVersion,launch_mode:C.launchMode,eligibility_basis:state.consentAttestation.eligibility_basis,participant_consent_attested:true,guardian_consent_attested:state.consentAttestation.guardian_consent_attested});
    if(response.server_mode&&response.server_mode!==C.launchMode)throw new Error(`페이지 모드(${C.launchMode})와 수집기 모드(${response.server_mode})가 다릅니다.`)
  }
  state.index=0;$("intro").hidden=true;$("resumePanel").hidden=true;$("study").hidden=false;showItem(false)
};

$("contactText").textContent=C.contact||"";
$("consentVersionText").textContent=C.consentVersion||"";
if(C.launchMode==="prelaunch")$("prelaunchBanner").hidden=false;
if(!configured()){$("setupBlocked").hidden=false;$("setupBlockedText").textContent="연구자가 config.js의 Collector URL과 문의처를 설정해야 합니다.";$("intro").hidden=true}

const dialog=$("consentDialog");
const consentScroll=$("consentScroll");
const acknowledge=$("acknowledgeConsent");
const openDialog=()=>{
  termsOpenedAt=termsOpenedAt||new Date().toISOString();
  acknowledge.disabled=true;
  $("scrollHint").textContent="내용을 끝까지 내려 읽으면 확인 버튼이 활성화됩니다.";
  consentScroll.scrollTop=0;
  if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
  requestAnimationFrame(()=>{if(consentScroll.scrollHeight<=consentScroll.clientHeight+8){acknowledge.disabled=false;$("scrollHint").textContent="내용을 확인한 뒤 버튼을 눌러 주세요."}consentScroll.focus()});
};
const closeDialog=()=>{if(typeof dialog.close==="function")dialog.close();else dialog.removeAttribute("open")};
$("openConsent").onclick=openDialog;
$("closeConsent").onclick=closeDialog;
$("cancelConsent").onclick=closeDialog;
consentScroll.addEventListener("scroll",()=>{const atEnd=consentScroll.scrollTop+consentScroll.clientHeight>=consentScroll.scrollHeight-24;if(atEnd){acknowledge.disabled=false;$("scrollHint").textContent="내용을 확인한 뒤 버튼을 눌러 주세요."}});
acknowledge.onclick=()=>{termsReadAt=new Date().toISOString();$("consent").disabled=false;$("consentReadStatus").textContent="전문 확인 완료 · 아래 확인란을 선택해 주세요.";closeDialog();$("consent").focus();updateStart()};
dialog.addEventListener("cancel",e=>{e.preventDefault();closeDialog()});

document.querySelectorAll('input[name="eligibility"]').forEach(x=>x.onchange=()=>{$("guardianBlock").hidden=!minorSelected();if(!minorSelected()){$("guardianConfirm").checked=false;guardianAcceptedAt=null}updateStart()});
$("guardianConfirm").onchange=()=>{guardianAcceptedAt=$("guardianConfirm").checked?new Date().toISOString():null;updateStart()};
$("consent").onchange=()=>{participantAcceptedAt=$("consent").checked?new Date().toISOString():null;updateStart()};
$("start").onclick=async()=>{try{$("startError").textContent="";await startFresh()}catch(e){$("startError").textContent=e.name==="AbortError"?"수집 서버 응답 시간이 초과되었습니다.":e.message}};

["leftImpression","rightImpression","comparison"].forEach(id=>{const el=$(id);const count=$(id==="leftImpression"?"leftCount":id==="rightImpression"?"rightCount":"comparisonCount");el.addEventListener("input",()=>{state.inputEvents++;count.textContent=String(el.value.length);save()});el.addEventListener("compositionend",save);el.addEventListener("paste",e=>{state.pasteEvents++;state.pastedCharacters+=(e.clipboardData?.getData("text")||"").length;save()})});
$("toChoice").onclick=()=>{const n=C.minimumFreeResponseCharacters||0;if($("comparison").value.trim().length<n){$("choiceError").textContent="두 글의 차이를 한 글자 이상 적거나, 판단하기 어렵다고 적어 주세요.";return}$("choiceError").textContent="";$("choicePanel").hidden=false;$("choicePanel").scrollIntoView({behavior:"smooth"});save()};
$("backToText").onclick=()=>{$("choicePanel").hidden=true;save()};
document.querySelectorAll('input[name="meaningRelation"],input[name="preference"]').forEach(x=>x.onchange=()=>{updateNextEnabled();save()});
$("nextItem").onclick=async()=>{try{const rec=await currentRecord();state.responses.push(rec);state.index++;state.pasteEvents=0;state.pastedCharacters=0;state.inputEvents=0;state.current=null;if(state.index<state.assignment.length)showItem(false);else{$("study").hidden=true;$("toolReport").hidden=false;save()}}catch(e){$("choiceError").textContent=e.message}};
document.querySelectorAll('input[name="aiUse"]').forEach(x=>x.onchange=()=>$("submitAll").disabled=false);
$("submitAll").onclick=async()=>{try{$("submitError").textContent="";const ai=document.querySelector('input[name="aiUse"]:checked')?.value;const contract=sourceContract();const payload={schema_version:"ksgt.human-pilot-response.v2",study_id:C.studyId,session_id:state.sessionId,run_mode:C.launchMode,...contract,consent_version:C.consentVersion,client_version:C.clientVersion,eligibility_basis:state.consentAttestation?.eligibility_basis||null,consent_attestation:state.consentAttestation,started_at_utc:state.startedAt,finished_at_utc:new Date().toISOString(),ai_assistance_self_report:ai,responses:state.responses,device:{user_agent:navigator.userAgent,language:navigator.language,viewport_css_px:[innerWidth,innerHeight],time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone}};localStorage.setItem(payloadKey,JSON.stringify(payload));const s=await api({action:"submit",payload});state.receipt=s.receipt;state.deletionProof=s.receipt.deletion_proof;save();$("toolReport").hidden=true;$("done").hidden=false;$("receipt").textContent=`수신 확인: ${s.receipt.receipt_hash}`;window.scrollTo({top:0,behavior:"smooth"})}catch(e){$("submitError").textContent=e.name==="AbortError"?"수집 서버 응답 시간이 초과되었습니다.":e.message}};
$("deleteButton").onclick=async()=>{try{const d=await api({action:"delete",study_id:C.studyId,response_id:state.receipt.response_id,deletion_proof:state.deletionProof});$("deleteStatus").textContent=`삭제 완료 · ${d.deletion_receipt}`;state.deleted=true;save()}catch(e){$("deleteStatus").textContent=`삭제하지 못했습니다: ${e.message}`}};
$("download").onclick=()=>{if(C.allowResponseCopyDownload===false)return;const b=new Blob([(localStorage.getItem(payloadKey)||"{}")+"\n"],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`${C.studyId}_my_response.json`;a.click();URL.revokeObjectURL(a.href)};
$("resetLocal").onclick=()=>{if(confirm("이 기기에 임시 저장된 작성 내용을 지울까요?")){localStorage.removeItem(storageKey);localStorage.removeItem(payloadKey);location.reload()}};
$("resumeButton").onclick=()=>{$("resumePanel").hidden=true;$("study").hidden=false;showItem(true)};
$("discardResume").onclick=()=>{localStorage.removeItem(storageKey);state=initialState();$("resumePanel").hidden=true;$("intro").hidden=false};

const raw=localStorage.getItem(storageKey);
if(raw&&configured())try{const persisted=JSON.parse(raw);if(persisted.receipt){state=persisted;$("intro").hidden=true;$("done").hidden=false;$("receipt").textContent=`수신 확인: ${persisted.receipt.receipt_hash}`;$("saveState").textContent="이전 제출 기록 복구됨";if(persisted.deleted)$("deleteStatus").textContent="삭제 완료 기록 복구됨"}else if(persisted.sessionId&&persisted.assignment?.length&&persisted.index<persisted.assignment.length){state=persisted;$("intro").hidden=true;$("resumePanel").hidden=false;$("saveState").textContent="작성 중인 응답 발견"}}catch{localStorage.removeItem(storageKey)}
})();

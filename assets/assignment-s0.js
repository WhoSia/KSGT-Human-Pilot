(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.KSGT_S0_ASSIGNMENT=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const asInt=(value,min,max)=>{
    if(value===null||value===undefined||value==="")return null;
    const n=Number(value);
    return Number.isInteger(n)&&n>=min&&n<=max?n:null;
  };
  const makeRng=seed=>{
    let x=seed>>>0;
    return ()=>((x=(1664525*x+1013904223)>>>0)/4294967296);
  };
  const shuffle=(array,rng)=>{
    const out=[...array];
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(rng()*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  };
  const validateBank=bank=>{
    if(!bank||typeof bank!=="object")throw new Error("S0 문항 bank 형식이 올바르지 않습니다.");
    if(!Array.isArray(bank.items)||bank.items.length<1)throw new Error("S0 문항 bank가 비어 있습니다.");
    const protocol=bank.assignment_protocol||{};
    const strata=protocol.strata_order||[];
    if(strata.length!==3)throw new Error("S0 배정 층이 정확히 3개여야 합니다.");
    const ids=new Set();
    for(const item of bank.items){
      if(!item.item_id||ids.has(item.item_id))throw new Error("S0 item_id가 없거나 중복됩니다.");
      ids.add(item.item_id);
      if(typeof item.variant_a_text!=="string"||typeof item.variant_b_text!=="string")throw new Error(`${item.item_id} 문안이 올바르지 않습니다.`);
    }
    for(const stratum of strata){
      if(!bank.items.some(x=>x.active!==false&&x.assignment_stratum===stratum))throw new Error(`${stratum} 배정층이 비어 있습니다.`);
    }
    return true;
  };
  const assign=(bank,options={})=>{
    validateBank(bank);
    const protocol=bank.assignment_protocol;
    const cycle=Number(protocol.cohort_cycle)||12;
    const seed=(Number(options.seed)>>>0);
    const requestedBlock=asInt(options.block,0,1);
    const requestedCohort=asInt(options.cohort,0,cycle-1);
    const scheduled=requestedBlock!==null&&requestedCohort!==null;
    const block=scheduled?requestedBlock:(seed&1);
    const cohort=scheduled?requestedCohort:(seed%cycle);
    const source=scheduled?"scheduled_link":"random_fallback";
    const rng=makeRng(seed^0x4b534754^((block+1)*2654435761)^(cohort*2246822519));
    const selected=[];
    for(const stratum of protocol.strata_order){
      const candidates=bank.items
        .filter(x=>x.active!==false&&x.assignment_stratum===stratum)
        .sort((a,b)=>a.item_id.localeCompare(b.item_id));
      const item=candidates[cohort%candidates.length];
      const orientation=protocol.orientation_blocks[String(block)][stratum];
      const reverse=orientation==="BA";
      selected.push({
        item_id:item.item_id,
        assignment_stratum:stratum,
        priority_rank:item.priority_rank??null,
        constructs:Array.isArray(item.constructs)?[...item.constructs]:[],
        item_question:item.question||null,
        left_text:reverse?item.variant_b_text:item.variant_a_text,
        right_text:reverse?item.variant_a_text:item.variant_b_text,
        presentation_order:orientation,
        display_left_variant:reverse?"B":"A",
        display_right_variant:reverse?"A":"B"
      });
    }
    return {
      assignment:shuffle(selected,rng),
      meta:{
        bank_id:bank.bank_id,
        study_phase:bank.study_phase,
        protocol_version:protocol.version,
        source_synthetic_study:bank.source_synthetic_study,
        source_response_set_sha256:bank.source_response_set_sha256,
        assignment_seed:seed,
        assignment_block:block,
        assignment_cohort:cohort,
        assignment_source:source,
        assignment_slot:options.slot||null,
        strata_order:[...protocol.strata_order]
      }
    };
  };
  return {assign,validateBank,shuffle,makeRng};
});

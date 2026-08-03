window.KSGT_CONFIG = Object.freeze({
  studyId: "KSGT-H0-PILOT-002",
  studyPhase: "KSGT-0.3.25",
  clientVersion: "0.3.25-human-linked-s0-pages-rc1",
  consentVersion: "H0-ko-v3",

  launchMode: "pilot",

  collectorUrl: "https://script.google.com/macros/s/AKfycbzMG73a__B3vinn8bPT3-eyroPuMJfTKmHpkMvjKZNSqGmimmynmnZq7HFTWj3_VWMj/exec",
  contact: "설문 링크를 전달한 연구자에게 문의해 주세요.",
  itemSource: "data/s0_items.json",
  assignmentCount: 3,
  assignmentProtocolVersion: "KSGT-0.3.25-STRATIFIED-3-BLOCK-1",
  adultAgeThreshold: 18,
  minimumFreeResponseCharacters: 1,
  storagePrefix: "ksgt-0325-human-linked-s0-rc1",
  allowResponseCopyDownload: true,
  requireInvitation: false,
  requireScheduledAssignment: false
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("prelaunchBanner")?.remove();
});

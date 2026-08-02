window.KSGT_CONFIG = Object.freeze({
  studyId: "KSGT-H0-PILOT-002",
  clientVersion: "0.3.23-human-pilot-pages-rc3",
  consentVersion: "H0-ko-v3",

  // RC3 동의문과 Collector를 다시 검사할 때까지 안전 잠금 상태입니다.
  launchMode: "prelaunch", // prelaunch | pilot

  collectorUrl: "https://script.google.com/macros/s/AKfycbzMG73a__B3vinn8bPT3-eyroPuMJfTKmHpkMvjKZNSqGmimmynmnZq7HFTWj3_VWMj/exec",
  contact: "설문 링크를 전달한 연구자에게 문의해 주세요.",
  itemSource: "data/items.json",
  assignmentCount: 3,
  adultAgeThreshold: 18,
  minimumFreeResponseCharacters: 1,
  storagePrefix: "ksgt-h0-pilot-002-rc3",
  allowResponseCopyDownload: true,
  requireInvitation: false
});

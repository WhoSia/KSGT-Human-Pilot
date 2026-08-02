window.KSGT_CONFIG = Object.freeze({
  studyId: "KSGT-H0-PILOT-002",
  clientVersion: "0.3.23-human-pilot-pages-rc2",
  consentVersion: "H0-ko-v2",

  // 첫 배포는 반드시 prelaunch로 둡니다.
  // 실제 외부 참여자를 받기 직전에만 pilot으로 바꿉니다.
  launchMode: "prelaunch", // prelaunch | pilot

  collectorUrl: "https://script.google.com/macros/s/AKfycbzMG73a__B3vinn8bPT3-eyroPuMJfTKmHpkMvjKZNSqGmimmynmnZq7HFTWj3_VWMj/exec",
  contact: "설문 링크를 전달한 연구자에게 문의해 주세요.",
  itemSource: "data/items.json",
  assignmentCount: 3,
  minimumAge: 18,
  minimumFreeResponseCharacters: 1,
  storagePrefix: "ksgt-h0-pilot-002",
  allowResponseCopyDownload: true,
  requireInvitation: false
});

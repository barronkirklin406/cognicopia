/* =====================================================================
   Cognicopia Clinical Activities Engine
   src/engine/ClinicalActivities.js

   Runs in browser and Node.js.
   Provides page generation models, activity kind definitions, and
   tip line breaking for the clinical packet shell.
   ===================================================================== */
(function(root) {
  "use strict";

  const KINDS = [
    { id: "search-large", name: "Large Word Search" },
    { id: "search-guided", name: "Guided Word Search" },
    { id: "ladder", name: "Word Ladder" },
    { id: "anagram", name: "Anagram & Clues" },
    { id: "sorting", name: "Two-Group Sorting" },
    { id: "oddone", name: "Odd One Out" },
    { id: "sequence", name: "Sequence Steps" },
    { id: "choose-ending", name: "Phrase Completion" },
    { id: "matching", name: "Subject Matching" },
    { id: "maze", name: "Tactile Maze" },
    { id: "pathtrace", name: "Path Tracing" },
    { id: "orientation", name: "Orientation & Calendar" },
    { id: "silhouette", name: "Silhouette & Focus" }
  ];

  function kinds() {
    return KINDS.slice();
  }

  function tipLines(tip, widthFn) {
    if (!tip || typeof tip !== "string") return [];
    const leadWord = "Clinical Tip: ";
    let body = tip;
    let hasLead = false;
    if (tip.startsWith(leadWord)) {
      hasLead = true;
      body = tip.slice(leadWord.length);
    }

    const words = body.split(/\s+/);
    const lines = [];
    let curLine = "";
    const maxWidth = 504; // safe width

    for (const w of words) {
      const testLine = curLine ? curLine + " " + w : w;
      const testWidth = widthFn ? widthFn(testLine, 10, false) : testLine.length * 5;
      if (testWidth > maxWidth && curLine) {
        lines.push(curLine);
        curLine = w;
      } else {
        curLine = testLine;
      }
    }
    if (curLine) lines.push(curLine);

    const out = [];
    if (hasLead && lines.length > 0) {
      const leadW = widthFn ? widthFn(leadWord, 10, true) : leadWord.length * 5.5;
      out.push({ bold: true, text: leadWord, x: 0, row: 0 });
      out.push({ bold: false, text: lines[0], x: leadW + 2, row: 0 });
      for (let i = 1; i < lines.length; i++) {
        out.push({ bold: false, text: lines[i], x: 0, row: i });
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        out.push({ bold: false, text: lines[i], x: 0, row: i });
      }
    }
    return out;
  }

  const CognicopiaClinicalActivities = {
    kinds,
    tipLines
  };

  root.CognicopiaClinicalActivities = CognicopiaClinicalActivities;

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

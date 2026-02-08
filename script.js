const host = document.getElementById("screenHost");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const whyBtn = document.getElementById("whyBtn");
const restartBtn = document.getElementById("restartBtn");

const screenLabel = document.getElementById("screenLabel");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");

const whyModal = document.getElementById("whyModal");
const whyBody = document.getElementById("whyBody");
const closeWhyBtn = document.getElementById("closeWhyBtn");
const modalCard = document.querySelector("#whyModal .modal-card");

const liveFeedback = document.getElementById("liveFeedback");

let index = 0;
let lastWhy = null;
let answeredCurrent = false;

let practiceResults = {};
let testScore = { correct: 0, total: 0 };

let lastFocusEl = null;

function announce(msg){
  liveFeedback.textContent = "";
  setTimeout(() => { liveFeedback.textContent = msg; }, 10);
}

function escapeHtml(str) {
  return str.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function closeModal(){
  whyModal.classList.remove("open");
  whyModal.setAttribute("aria-hidden", "true");
  if (lastFocusEl) lastFocusEl.focus();
}

function openModal(){
  if (!lastWhy) return;
  lastFocusEl = document.activeElement;
  whyBody.innerHTML = lastWhy;
  whyModal.classList.add("open");
  whyModal.setAttribute("aria-hidden", "false");
  if (modalCard) modalCard.focus();
}

closeWhyBtn.addEventListener("click", closeModal);
whyBtn.addEventListener("click", openModal);

restartBtn.addEventListener("click", () => {
  index = 0;
  lastWhy = null;
  answeredCurrent = false;
  practiceResults = {};
  testScore = { correct: 0, total: 0 };
  render();
});

backBtn.addEventListener("click", () => {
  if (index > 0) {
    index--;
    answeredCurrent = false;
    lastWhy = null;
    render();
  }
});

nextBtn.addEventListener("click", () => {
  if (!canMoveNext()) return;
  if (index < screens.length - 1) {
    index++;
    answeredCurrent = false;
    lastWhy = null;
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) nextBtn.click();
  if (e.key === "Enter" && e.shiftKey) backBtn.click();
  if (e.key === "Escape" && whyModal.classList.contains("open")) closeModal();
});

function canMoveNext() {
  const s = screens[index];
  if (s.type === "practice" || s.type === "test") return answeredCurrent;
  return true;
}

function setMeta() {
  screenLabel.textContent = `Screen ${index + 1}`;
  progressText.textContent = `${index + 1} / ${screens.length}`;
  progressBar.style.width = `${((index + 1) / screens.length) * 100}%`;

  backBtn.disabled = index === 0;
  whyBtn.disabled = !lastWhy;

  const needsAnswer = (screens[index].type === "practice" || screens[index].type === "test");
  nextBtn.disabled = needsAnswer ? !answeredCurrent : false;
  nextBtn.textContent = (index === screens.length - 1) ? "Finish" : "Next";
}

function render() {
  setMeta();
  host.innerHTML = screens[index].render();
  attachHandlers(screens[index]);

  const reviewPracticeBtn = host.querySelector("#reviewPracticeBtn");
  if (reviewPracticeBtn) {
    reviewPracticeBtn.addEventListener("click", () => {
      index = screens.findIndex(s => s.id === "practice-1");
      answeredCurrent = false;
      lastWhy = null;
      render();
    });
  }

  const retakeTestBtn = host.querySelector("#retakeTestBtn");
  if (retakeTestBtn) {
    retakeTestBtn.addEventListener("click", () => {
      testScore = { correct: 0, total: 0 };
      index = screens.findIndex(s => s.id === "test-intro");
      answeredCurrent = false;
      lastWhy = null;
      render();
    });
  }
}

function attachHandlers(screen) {
  const buttons = host.querySelectorAll("[data-choice]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      const choiceId = btn.getAttribute("data-choice");
      handleChoice(screen, choiceId);
    });
  });

  attachBranchHandlers();
}

function attachBranchHandlers() {
  const goDefBtn = host.querySelector("[data-go-definition]");
  if (goDefBtn) {
    goDefBtn.addEventListener("click", () => {
      index = screens.findIndex(s => s.id === "definition");
      answeredCurrent = false;
      lastWhy = null;
      render();
    });
  }

  const tryAgainBtn = host.querySelector("[data-try-again]");
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener("click", () => {
      const targetId = tryAgainBtn.getAttribute("data-try-again");
      index = screens.findIndex(s => s.id === targetId);
      answeredCurrent = false;
      lastWhy = null;
      render();
    });
  }
}

function analyzeAltText(alt) {
  const a = alt.toLowerCase().trim();
  const tooShort = a.length <= 6;
  const genericWords = ["image","photo","picture","woman","man","person","market","ocean","water","bridge","star","family"];
  const containsGeneric = genericWords.includes(a);
  const hasFileLike = a.includes(".png") || a.includes(".jpg") || a.includes("img_") || a.includes("screen");

  const hasActionOrContext =
    /(playing|walking|running|meeting|reading|holding|wearing|jumping|surfing|waiting|showing|infographic|visualization|map|chart|graph|report|at|in|on|with|during|behind|across|indoors|table|grass|window|background|platform|region|continents|by)/.test(a);

  const purposeSignals = hasActionOrContext;
  return { tooShort, containsGeneric, hasFileLike, purposeSignals };
}

function buildWhyHTML(item, isCorrect, learnerChoiceLabel) {
  const f = analyzeAltText(item.altText);

  const status = isCorrect ? `<div class="ok">✅ Correct</div>` : `<div class="no">❌ Not quite</div>`;

  const purposeLine = f.purposeSignals
    ? `<div><span class="ok">Purpose is there</span><div class="muted">There’s action/context, so it communicates meaning.</div></div>`
    : `<div><span class="no">Purpose is missing</span><div class="muted">This reads like a label, not what the image is for.</div></div>`;

  const riskLine = (f.containsGeneric || f.tooShort || f.hasFileLike)
    ? `<div><span class="warn">Common problem</span><div class="muted">Too short/generic or file-like. That usually fails.</div></div>`
    : `<div><span class="ok">No “vague label” signs</span><div class="muted">This doesn’t look like a one-word label or file name.</div></div>`;

  return `
    <p class="muted">${status} You chose: <b>${escapeHtml(learnerChoiceLabel)}</b></p>
    <div class="panel">
      <div class="muted">Alt text being evaluated</div>
      <div class="code">alt="${escapeHtml(item.altText)}"</div>

      <div class="kv">
        ${purposeLine}
        ${riskLine}
      </div>

      <div class="panel" style="margin-top:12px">
        <p class="muted" style="margin:0">
          The check is simple: <b>does this alt text communicate purpose?</b>
          If it only names what’s visible, it’s usually not enough.
        </p>
      </div>
    </div>
  `;
}

function buildDefinitionWhy(isCorrect, learnerChoiceLabel) {
  const status = isCorrect ? `<div class="ok">✅ Correct</div>` : `<div class="no">❌ Not quite</div>`;

  return `
    <p class="muted">${status} You chose: <b>${escapeHtml(learnerChoiceLabel)}</b></p>

    <div class="panel">
      <p class="muted"><b>What the definition is saying</b></p>
      <p class="muted">
        An image is accessible when the alt text communicates the image’s <b>purpose</b> to someone who cannot see it.
        That means it should add meaning (what it’s for), not just a short label like “image” or “photo.”
      </p>

      <div class="kv">
        <div>
          <div class="ok">What counts as correct</div>
          <div class="muted">“Alt text communicates the image’s purpose.”</div>
        </div>
        <div>
          <div class="warn">What is usually wrong</div>
          <div class="muted">Short labels that don’t add meaning (example: “image”, “photo”, “woman”).</div>
        </div>
      </div>
    </div>
  `;
}

function feedbackScreen(isCorrect, mode) {
  const status = isCorrect ? `<span class="ok">✅ Correct.</span>` : `<span class="no">❌ Not quite.</span>`;
  const main = isCorrect
    ? `You got it. This matches the rule: the alt text communicates the image’s purpose.`
    : `Not quite. This doesn’t match the rule. The alt text is either too vague or it focuses on appearance instead of purpose.`;
  const tip = `Click <b>Show me why</b> to see exactly what made this right or wrong.`;

  return `
    <h2>Feedback</h2>
    <div class="panel">
      <p class="muted">${status} ${main}</p>
      <p class="muted">${tip}</p>
      ${mode === "test" ? `<p class="muted"><b>Reminder:</b> your score is counted in the final report.</p>` : ``}
    </div>
  `;
}

function remediationScreen(item) {
  return `
    <h2>Diagnostic + remediation</h2>
    <p class="muted">
      If you chose “Accessible” for <b>alt="${escapeHtml(item.altText)}"</b>, that usually means you’re using
      “it has alt text” as the rule. But that’s not the rule.
    </p>

    <div class="panel">
      <p class="muted"><b>What it gives:</b> a label.</p>
      <p class="muted"><b>What’s missing:</b> purpose (what the image is doing for the user).</p>
      <p class="muted">Go back to the definition, then come back and try again.</p>
    </div>

    <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-go-definition type="button">Go to definition</button>
      <button class="btn btn-primary" data-try-again="${escapeHtml(item.id)}" type="button">Try again</button>
    </div>
  `;
}

function selfCheckScreen(item) {
  return `
    <h2>Self-check (you figure it out)</h2>
    <p class="muted">
      Before you retry, answer these questions to yourself. Don’t rush it.
    </p>

    <div class="code">alt="${escapeHtml(item.altText)}"</div>

    <div class="panel">
      <p class="muted"><b>1)</b> What is this image doing for the user?</p>
      <p class="muted"><b>2)</b> Does the alt text communicate that purpose?</p>
      <p class="muted"><b>3)</b> Is it just a label (one word), or does it add meaning?</p>
      <p class="muted"><b>4)</b> If you had to improve it, what would you add (action/context)?</p>
    </div>

    <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-go-definition type="button">Go to definition</button>
      <button class="btn btn-primary" data-try-again="${escapeHtml(item.id)}" type="button">Try again</button>
    </div>
  `;
}

function getPracticeStats() {
  const ids = Object.keys(practiceResults);
  const total = ids.length;
  const correct = ids.filter(id => practiceResults[id] === true).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent };
}

function handleChoice(screen, choiceId) {
  const item = screen.item;
  const choice = item.choices.find(c => c.id === choiceId);
  const isCorrect = choice.correct === true;

  answeredCurrent = true;

  if (screen.type === "practice") {
    if (!(screen.id in practiceResults)) {
      practiceResults[screen.id] = isCorrect;
    } else if (isCorrect) {
      practiceResults[screen.id] = true;
    }
  }

  if (screen.type === "test") {
    testScore.total++;
    if (isCorrect) testScore.correct++;
  }

  if (item.altText === "N/A") {
    lastWhy = buildDefinitionWhy(isCorrect, choice.label);
  } else {
    lastWhy = buildWhyHTML(item, isCorrect, choice.label);
  }

  whyBtn.disabled = !lastWhy;

  announce(isCorrect
    ? "Correct. This matches the rule about purpose."
    : "Not quite. This does not match the rule about purpose.");

  if (screen.type === "practice" && !isCorrect && item.altText !== "N/A") {
    answeredCurrent = false;
    lastWhy = null;

    if (screen.helpMode === "diagnostic") {
      host.innerHTML = remediationScreen({ ...item, id: screen.id });
      setMeta();
      attachBranchHandlers();
      announce("Review the remediation, then try again.");
      return;
    }

    host.innerHTML = selfCheckScreen({ ...item, id: screen.id });
    setMeta();
    attachBranchHandlers();
    announce("Use the self-check prompts, then try again.");
    return;
  }

  host.innerHTML = feedbackScreen(isCorrect, screen.type);
  setMeta();
}

function contentScreen(id, html) {
  return { id, type: "content", render: () => html };
}

function practiceScreen(item) {
  return {
    id: item.id,
    type: "practice",
    helpMode: item.helpMode || "self",
    item,
    render: () => `
      <h2>${item.title}</h2>
      <p class="muted">${item.prompt}</p>
      ${item.altText !== "N/A" ? `<div class="code">alt="${escapeHtml(item.altText)}"</div>` : ""}

      <div class="panel" aria-label="Answer choices">
        ${item.choices.map(c => `
          <button class="choice" data-choice="${c.id}" type="button">${c.label}</button>
        `).join("")}
      </div>

      <p class="muted">After you answer, use <b>Show me why</b> to see what made it right or wrong.</p>
    `
  };
}

function testScreen(item) {
  return {
    id: item.id,
    type: "test",
    item,
    render: () => `
      <h2>${item.title}</h2>
      <p class="muted">${item.prompt}</p>
      ${item.altText !== "N/A" ? `<div class="code">alt="${escapeHtml(item.altText)}"</div>` : ""}

      <div class="panel" aria-label="Answer choices">
        ${item.choices.map(c => `
          <button class="choice" data-choice="${c.id}" type="button">${c.label}</button>
        `).join("")}
      </div>
    `
  };
}

const screens = [
  contentScreen("title", `
    <h1>Evaluating Images and Alt Text for Accessibility</h1>
    <p>
      In this tutorial, you’re going to learn how to tell when an image on a webpage is accessible
      for screen reader users based on the quality of the alt text.
    </p>

    <h2>Statement of objective</h2>
    <p>
      When presented with images and their associated alt text, you will be able to decide whether each image is
      accessible or inaccessible by deciding whether the alt text communicates the image’s purpose.
      You should be able to correctly identify at least <b>five out of six</b> images.
    </p>
  `),

  contentScreen("overview", `
    <h2>Overview of new material</h2>
    <p>
      Here’s the main idea: an image can look fine visually, but still be inaccessible if the alt text is missing
      or too vague.
    </p>
    <p>
      The rule we’re using is simple: <b>an image is accessible only if the alt text communicates the image’s purpose</b>.
      Not just what it looks like. What it’s for.
    </p>
  `),

  contentScreen("definition", `
    <h2>Definition</h2>
    <div class="panel">
      <p class="muted">
        <b>Accessible image:</b> An image is accessible when its alt text clearly communicates the <b>purpose</b> of the image
        to a user who cannot see it.
      </p>
      <p class="muted">
        <b>Inaccessible image:</b> An image is inaccessible when its alt text is missing, vague, misleading, or focuses on appearance
        rather than purpose.
      </p>
      <p class="muted">
        <b>Quick check:</b> Ask yourself: <em>“What is this image doing for the user?”</em>
      </p>
    </div>
  `),

  practiceScreen({
    id: "practice-1",
    title: "Practice (Remember): definition check",
    prompt: "Which statement best describes an accessible image?",
    altText: "N/A",
    choices: [
      { id: "a", label: "Alt text communicates the image’s purpose", correct: true },
      { id: "b", label: "Alt text is a short label like “image” or “photo”", correct: false }
    ]
  }),

  practiceScreen({
    id: "practice-2",
    helpMode: "diagnostic",
    title: "Practice (Use): apply the rule",
    prompt: "Alt text: alt=\"woman\". Is this image accessible or inaccessible?",
    altText: "woman",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  practiceScreen({
    id: "practice-3",
    helpMode: "diagnostic",
    title: "Practice (Use): apply the rule",
    prompt: "Alt text: alt=\"bridge\". Accessible or inaccessible?",
    altText: "bridge",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  practiceScreen({
    id: "practice-4",
    helpMode: "self",
    title: "Practice (Use): apply the rule",
    prompt: "Alt text: alt=\"A golden retriever puppy playing with a ball on the grass\". Accessible or inaccessible?",
    altText: "A golden retriever puppy playing with a ball on the grass",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  practiceScreen({
    id: "practice-5",
    helpMode: "diagnostic",
    title: "Practice (Use): apply the rule",
    prompt: "Alt text: alt=\"Ocean\". Accessible or inaccessible?",
    altText: "Ocean",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  practiceScreen({
    id: "practice-6",
    helpMode: "self",
    title: "Practice (Use): apply the rule",
    prompt: "Alt text: alt=\"Child playing with LEGO castle pieces at a table indoors\". Accessible or inaccessible?",
    altText: "Child playing with LEGO castle pieces at a table indoors",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  practiceScreen({
    id: "practice-7",
    helpMode: "self",
    title: "Practice (Use): apply the rule",
    prompt: "Alt text: alt=\"Network visualization showing global transportation clusters by region, with colored nodes and connecting routes across continents\". Accessible or inaccessible?",
    altText: "Network visualization showing global transportation clusters by region, with colored nodes and connecting routes across continents",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  contentScreen("test-intro", `
    <h2>Test</h2>
    <p class="muted">
      Now you’re going to take a short test. You’ll answer <b>6 questions</b>:
      one question for recall/paraphrase of the definition and five questions where you apply the concept in a different setting than the instruction.
    </p>
    <p class="muted">The test keeps track of your score and reports it at the end.</p>
  `),

  testScreen({
    id: "test-1",
    title: "Test 1 (Remember)",
    prompt: "Which statement best describes an accessible image?",
    altText: "N/A",
    choices: [
      { id: "a", label: "Alt text communicates the image’s purpose", correct: true },
      { id: "b", label: "Alt text is a short label like “image”", correct: false }
    ]
  }),

  testScreen({
    id: "test-2",
    title: "Test 2 (Use)",
    prompt: "Alt text: alt=\"star\". Accessible or inaccessible?",
    altText: "star",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  testScreen({
    id: "test-3",
    title: "Test 3 (Use)",
    prompt: "Alt text: alt=\"Raindrops on a window with blurred city lights and pedestrians in the background\". Accessible or inaccessible?",
    altText: "Raindrops on a window with blurred city lights and pedestrians in the background",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  testScreen({
    id: "test-4",
    title: "Test 4 (Use)",
    prompt: "Alt text: alt=\"Market\". Accessible or inaccessible?",
    altText: "Market",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  testScreen({
    id: "test-5",
    title: "Test 5 (Use)",
    prompt: "Alt text: alt=\"Volcano erupting with a large plume of ash rising into the sky\". Accessible or inaccessible?",
    altText: "Volcano erupting with a large plume of ash rising into the sky",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  testScreen({
    id: "test-6",
    title: "Test 6 (Use)",
    prompt: "Alt text: alt=\"family\". Accessible or inaccessible?",
    altText: "family",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  {
    id: "results",
    type: "content",
    render: () => {
      const p = getPracticeStats();
      const practicePassed = p.percent >= 85;

      const testPercent =
        testScore.total === 0
          ? 0
          : Math.round((testScore.correct / testScore.total) * 100);

      const testPassed = testPercent >= 85;

      return `
        <h2>Score report</h2>

        <div class="panel">
          <p class="muted">
            Practice score (not graded):
            <b>${p.correct}</b> / <b>${p.total}</b> (${p.percent}%)
          </p>

          <p class="muted">
            Practice requirement: <b>85% or higher</b>
          </p>

          <p class="${practicePassed ? "ok" : "no"}">
            ${practicePassed
              ? "✅ Practice requirement met."
              : "❌ Practice requirement not met yet. You should review the practice items again."}
          </p>

          <hr style="border:none;border-top:1px solid #e7e9f5;margin:16px 0" />

          <p class="muted">
            Test score:
            <b>${testScore.correct}</b> / <b>${testScore.total}</b>
            (${testPercent}%)
          </p>

          <p class="${testPassed ? "ok" : "no"}">
            ${testPassed
              ? "✅ You passed the test."
              : "❌ You did not pass the test. You need more practice before retaking it."}
          </p>

          <p class="muted">
            If you missed anything, go back and focus on the decision rule:
            the alt text has to communicate <b>purpose</b>, not just a label.
          </p>

          <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button class="btn btn-ghost" id="reviewPracticeBtn" type="button">
              Review practice
            </button>

            <button class="btn btn-primary" id="retakeTestBtn" type="button">
              Retake test
            </button>
          </div>
        </div>
      `;
    }
  }
];

render();

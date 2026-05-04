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
let answeredTests = {};

let lastFocusEl = null;

function announce(msg){
  liveFeedback.textContent = "";
  setTimeout(() => { liveFeedback.textContent = msg; }, 10);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
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
  answeredTests = {};
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
  if (e.key === "Enter" && !e.shiftKey && !whyModal.classList.contains("open")) nextBtn.click();
  if (e.key === "Enter" && e.shiftKey && !whyModal.classList.contains("open")) backBtn.click();
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
      answeredTests = {};
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

function imageBlock(item) {
  if (!item.image) return "";

  return `
    <figure class="image-card">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.displayAlt || item.altText || "")}">
      ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}
    </figure>
  `;
}

function analyzeAltText(alt) {
  const a = String(alt).toLowerCase().trim();
  const tooShort = a.length <= 8;
  const genericWords = [
    "image","photo","picture","woman","women","man","person","market",
    "ocean","water","bridge","star","family","recipe","chart","trading",
    "basketball game"
  ];
  const containsGeneric = genericWords.includes(a);
  const hasFileLike = a.includes(".png") || a.includes(".jpg") || a.includes("img_") || a.includes("screen");

  const hasActionOrContext =
    /(playing|walking|running|meeting|reading|holding|wearing|jumping|surfing|waiting|showing|infographic|visualization|map|chart|graph|report|at|in|on|with|during|behind|across|indoors|table|grass|window|background|platform|region|continents|by|teacher|students|classroom|recipe|instructions|bridge closed|flooding|server|data center|revenue|presentation|financial|trading|trend|technical|basketball|movement|arrows|destinations)/.test(a);

  return { tooShort, containsGeneric, hasFileLike, purposeSignals: hasActionOrContext };
}

function buildWhyHTML(item, isCorrect, learnerChoiceLabel) {
  const f = analyzeAltText(item.altText);

  const status = isCorrect ? `<div class="ok">✅ Correct</div>` : `<div class="no">❌ Not quite</div>`;

  const purposeLine = f.purposeSignals
    ? `<div><span class="ok">Purpose is there</span><div class="muted">There is action, context, or useful meaning in the alt text.</div></div>`
    : `<div><span class="no">Purpose is missing</span><div class="muted">This reads like a label, not what the image is doing for the user.</div></div>`;

  const riskLine = (f.containsGeneric || f.tooShort || f.hasFileLike)
    ? `<div><span class="warn">Common problem</span><div class="muted">Too short, generic, or file-like. That usually fails because it leaves out meaning.</div></div>`
    : `<div><span class="ok">No “vague label” signs</span><div class="muted">This does not look like a one-word label or file name.</div></div>`;

  const purposeSupport = item.expectedPurpose
    ? `<div><span class="warn">Image purpose</span><div class="muted">${escapeHtml(item.expectedPurpose)}</div></div>`
    : "";

  const betterAlt = item.betterAlt
    ? `<div class="panel" style="margin-top:12px">
        <p class="muted" style="margin:0"><b>Better alt text:</b> ${escapeHtml(item.betterAlt)}</p>
      </div>`
    : "";

  return `
    <p class="muted">${status} You chose: <b>${escapeHtml(learnerChoiceLabel)}</b></p>
    <div class="panel">
      ${imageBlock(item)}

      <div class="muted">Alt text being evaluated</div>
      <div class="code">alt="${escapeHtml(item.altText)}"</div>

      <div class="kv">
        ${purposeLine}
        ${riskLine}
        ${purposeSupport}
      </div>

      ${betterAlt}

      <div class="panel" style="margin-top:12px">
        <p class="muted" style="margin:0">
          The check is simple: <b>does this alt text communicate purpose?</b>
          Compare the image to the alt text. If it only names what is visible, it is usually not enough.
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
        That means it should add meaning, not just a short label like “image,” “photo,” or “woman.”
      </p>

      <div class="kv">
        <div>
          <div class="ok">What counts as correct</div>
          <div class="muted">“Alt text communicates the image’s purpose.”</div>
        </div>
        <div>
          <div class="warn">What is usually wrong</div>
          <div class="muted">Short labels that do not add meaning.</div>
        </div>
      </div>
    </div>
  `;
}

function feedbackScreen(item, isCorrect, mode) {
  const status = isCorrect ? `<span class="ok">✅ Correct.</span>` : `<span class="no">❌ Not quite.</span>`;
  const main = isCorrect
    ? `You got it. This matches the rule: the alt text communicates the image’s purpose.`
    : `Not quite. This does not match the rule. The alt text is either too vague or it focuses on appearance instead of purpose.`;
  const tip = `Click <b>Show me why</b> to see exactly what made this right or wrong.`;

  return `
    <h2>Feedback</h2>
    <div class="panel">
      ${imageBlock(item)}
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
      If you chose “Accessible” for <b>alt="${escapeHtml(item.altText)}"</b>, that usually means you are using
      “it has alt text” as the rule. But that is not the rule.
    </p>

    <div class="panel">
      ${imageBlock(item)}
      <p class="muted"><b>What the image shows:</b> ${escapeHtml(item.visualFocus || "Look closely at the image context.")}</p>
      <p class="muted"><b>What it gives:</b> ${escapeHtml(item.altText)}</p>
      <p class="muted"><b>What is missing:</b> ${escapeHtml(item.expectedPurpose || "The purpose or meaning of the image.")}</p>
      ${item.betterAlt ? `<p class="muted"><b>Better alt text:</b> ${escapeHtml(item.betterAlt)}</p>` : ""}
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

    <div class="panel">
      ${imageBlock(item)}
      <div class="code">alt="${escapeHtml(item.altText)}"</div>
    </div>

    <div class="panel">
      <p class="muted"><b>1)</b> What is this image doing for the user?</p>
      <p class="muted"><b>2)</b> Does the alt text communicate that purpose?</p>
      <p class="muted"><b>3)</b> Is it just a label, or does it add meaning?</p>
      <p class="muted"><b>4)</b> If you had to improve it, what would you add?</p>
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

  if (screen.type === "test" && !answeredTests[screen.id]) {
    answeredTests[screen.id] = true;
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

  host.innerHTML = feedbackScreen(item, isCorrect, screen.type);
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

      ${imageBlock(item)}

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

      ${imageBlock(item)}

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
    prompt: "Look at the image and alt text. Is this image accessible or inaccessible?",
    image: "image/women.png",
    caption: "Image scenario: three women are shown in a posed portrait.",
    altText: "woman",
    visualFocus: "The image shows three women in a posed portrait.",
    expectedPurpose: "The alt text should describe the group portrait, not just use one vague label.",
    betterAlt: "Three women posing together for a portrait",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  practiceScreen({
    id: "practice-3",
    helpMode: "diagnostic",
    title: "Practice (Use): apply the rule",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/bridgeflood.png",
    caption: "Image scenario: a bridge is closed because of flooding.",
    altText: "bridge",
    visualFocus: "The image shows a bridge blocked by signs and surrounded by flood water.",
    expectedPurpose: "The image warns the user that the bridge is closed because of flooding.",
    betterAlt: "Bridge closed because of flooding, with warning signs blocking the road",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  practiceScreen({
    id: "practice-4",
    helpMode: "self",
    title: "Practice (Use): apply the rule",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/goldenretriver.png",
    caption: "Image scenario: a golden retriever is carrying a ball across grass.",
    altText: "A golden retriever puppy playing with a ball on the grass",
    visualFocus: "The dog is carrying or playing with a ball on grass.",
    expectedPurpose: "The image communicates the dog’s action and setting.",
    betterAlt: "Golden retriever carrying a ball across the grass",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  practiceScreen({
    id: "practice-5",
    helpMode: "diagnostic",
    title: "Practice (Use): apply the rule",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/cookinginstr.png",
    caption: "Image scenario: a veggie ramen recipe card shows ingredients and cooking steps.",
    altText: "recipe",
    visualFocus: "The image is a recipe card with ingredients and step-by-step cooking instructions.",
    expectedPurpose: "The image gives cooking instructions, not just the fact that it is a recipe.",
    betterAlt: "Veggie ramen recipe card showing ingredients and four cooking steps",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  practiceScreen({
    id: "practice-6",
    helpMode: "self",
    title: "Practice (Use): apply the rule",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/classroom.png",
    caption: "Image scenario: a teacher presents a science lesson about water to students.",
    altText: "Teacher presenting a lesson about water to students in a classroom",
    visualFocus: "The teacher is presenting a water lesson while students watch.",
    expectedPurpose: "The image communicates a classroom teaching activity.",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  practiceScreen({
    id: "practice-7",
    helpMode: "self",
    title: "Practice (Use): apply the rule",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/techearningbymin.png",
    caption: "Image scenario: a bar chart compares revenue per minute for major tech companies.",
    altText: "Chart showing revenue per minute of major tech companies",
    visualFocus: "The chart compares revenue per minute across companies.",
    expectedPurpose: "The image summarizes a data comparison.",
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
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/nba.png",
    caption: "Image scenario: a basketball play diagram uses arrows to show player movement.",
    altText: "basketball game",
    visualFocus: "The image shows arrows explaining player movement on a basketball court.",
    expectedPurpose: "The image explains movement and positioning, not just that a game is happening.",
    betterAlt: "Basketball play diagram showing player movement arrows on the court",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  testScreen({
    id: "test-3",
    title: "Test 3 (Use)",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/datacenter.png",
    caption: "Image scenario: a worker uses a tablet while checking server racks.",
    altText: "Technician checking server racks with a tablet in a data center",
    visualFocus: "A person is checking equipment in a server room.",
    expectedPurpose: "The image communicates data center monitoring work.",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  testScreen({
    id: "test-4",
    title: "Test 4 (Use)",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/destination.png",
    caption: "Image scenario: a chart compares domestic and international bucket list destinations.",
    altText: "chart",
    visualFocus: "The chart compares travel destination rankings.",
    expectedPurpose: "The image summarizes top domestic and international bucket list destinations.",
    betterAlt: "Chart comparing top domestic and international bucket list destinations",
    choices: [
      { id: "accessible", label: "Accessible", correct: false },
      { id: "inaccessible", label: "Inaccessible", correct: true }
    ]
  }),

  testScreen({
    id: "test-5",
    title: "Test 5 (Use)",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/finance_presentation.png",
    caption: "Image scenario: a presenter explains financial data to a group.",
    altText: "Presenter explaining financial data to a team",
    visualFocus: "A presenter points toward financial data on a display.",
    expectedPurpose: "The image communicates a finance presentation.",
    choices: [
      { id: "accessible", label: "Accessible", correct: true },
      { id: "inaccessible", label: "Inaccessible", correct: false }
    ]
  }),

  testScreen({
    id: "test-6",
    title: "Test 6 (Use)",
    prompt: "Look at the image and alt text. Accessible or inaccessible?",
    image: "image/trading.png",
    caption: "Image scenario: a trading chart shows price movement, trend lines, and indicators.",
    altText: "trading",
    visualFocus: "The chart shows candlesticks, trend lines, and technical indicators.",
    expectedPurpose: "The image communicates market movement and technical analysis.",
    betterAlt: "Trading chart showing price movement, trend lines, and technical indicators",
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
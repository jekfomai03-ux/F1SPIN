
const WIN_INDEX = 52;
const STRIP_LENGTH = 60;
const SPIN_DURATION = 5000;

const PRIZES = [
    { name: "20 бонусов",              hours: 0.25, rarity: "common",    icon: "⏳", basicWeight: 24 },
    { name: "30 бонусов",              hours: 0.5,  rarity: "common",    icon: "⏳", basicWeight: 24 },
    { name: "120 бонусов",                 hours: 1,    rarity: "rare",      icon: "🕐", basicWeight: 18 },
    { name: "флеш",              hours: 1.5,  rarity: "rare",      icon: "🥤", basicWeight: 16 },
    { name: "сникерс",    hours: 2,    rarity: "rare",      icon: "⚡", basicWeight: 14 },
    { name: "390 бонусов",     hours: 3,    rarity: "epic",      icon: "🥤" },
    { name: "290 бонусов+флеш",     hours: 3,    rarity: "epic",      icon: "🥤" },
    { name: "600 бонусов",     hours: 5,    rarity: "legendary", icon: "💎" },
    { name: "400 бонусов+Red Bull",     hours: 5,    rarity: "legendary", icon: "💎" },
    { name: "1000 бонусов+сникерс+Red Bull",    hours: 12,   rarity: "mythical",  icon: "🎫" },
    { name: "3000 бонусов",               hours: 24,   rarity: "godlike",   icon: "👑" }
];

const SPIN_INTERVAL = { rare: 7, epic: 23, legendary: 37, mythical: 59, godlike: 103 };
const STORAGE_COUNTERS = "f1club_counters";
const STORAGE_ABO_CLAIMED = "f1club_abo_claimed";

const GRAY_PRIZES = PRIZES.filter(p => p.rarity === "common");
const BLUE_PRIZES = PRIZES.filter(p => p.rarity === "rare");

const rouletteTrack = document.getElementById("rouletteTrack");
const rouletteViewport = document.getElementById("rouletteViewport");
const rouletteWrapper = document.querySelector(".roulette-wrapper");
const openBtn = document.getElementById("openCaseBtn");
const caseIcon = document.getElementById("caseIcon");
const resultTitle = document.getElementById("resultTitle");
const resultPrize = document.getElementById("resultPrize");
const prizesLegend = document.getElementById("prizesLegend");
const spinCounterEl = document.getElementById("spinCounter");
const spinSound = document.getElementById("spinSound");

let isSpinning = false;
let activeAnimation = null;

function playSpinSound() {
    if (!spinSound) return;
    spinSound.pause();
    spinSound.currentTime = 0;
    const playPromise = spinSound.play();
    if (playPromise?.catch) playPromise.catch(() => {});
}

function stopSpinSound() {
    if (!spinSound) return;
    spinSound.pause();
    spinSound.currentTime = 0;
}

function getItemWidth() {
    const first = rouletteTrack.querySelector(".roulette-item");
    if (!first) return 162;
    const style = getComputedStyle(first);
    return first.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
}

function setTrackX(x) {
    rouletteTrack.style.transform = `translate3d(${x}px, 0, 0)`;
}

function spinProgress(t) {
    if (t >= 1) return 1;
    if (t <= 0) return 0;

    const accelEnd = 0.07;
    const cruiseEnd = 0.58;
    const afterAccel = 0.04;
    const afterCruise = 0.78;

    if (t < accelEnd) {
        const u = t / accelEnd;
        return afterAccel * u * u * (3 - 2 * u);
    }

    if (t < cruiseEnd) {
        const u = (t - accelEnd) / (cruiseEnd - accelEnd);
        return afterAccel + (afterCruise - afterAccel) * u;
    }

    const u = (t - cruiseEnd) / (1 - cruiseEnd);
    const decel = 1 - Math.pow(1 - u, 3);
    return afterCruise + (1 - afterCruise) * decel;
}

function animateStrip(startX, endX, duration, onComplete) {
    if (activeAnimation) {
        cancelAnimationFrame(activeAnimation);
        activeAnimation = null;
    }

    const startTime = performance.now();
    rouletteWrapper.classList.add("is-spinning");
    setTrackX(startX);

    function frame(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = spinProgress(progress);
        const x = startX + (endX - startX) * eased;
        setTrackX(x);

        if (progress < 1) {
            activeAnimation = requestAnimationFrame(frame);
        } else {
            activeAnimation = null;
            setTrackX(endX);
            rouletteWrapper.classList.remove("is-spinning");
            onComplete?.();
        }
    }

    activeAnimation = requestAnimationFrame(frame);
}

function loadCounters() {
    try {
        const saved = localStorage.getItem(STORAGE_COUNTERS);
        if (saved) return JSON.parse(saved);
    } catch (_) { /* ignore */ }
    return { total: 0, blue: 0, epic: 0, legendary: 0, mythical: 0, godlike: 0 };
}

function saveCounters(counters) {
    localStorage.setItem(STORAGE_COUNTERS, JSON.stringify(counters));
}

function updateSpinUI(counters) {
    if (!spinCounterEl) return;
    spinCounterEl.textContent = `Спин: ${counters.total}`;
    spinCounterEl.title =
        `Синий ${counters.blue}/${SPIN_INTERVAL.rare} · ` +
        `фиолет. ${counters.epic}/${SPIN_INTERVAL.epic} · ` +
        `розов. ${counters.legendary}/${SPIN_INTERVAL.legendary} · ` +
        `красн. ${counters.mythical}/${SPIN_INTERVAL.mythical} · ` +
        `золот. ${counters.godlike}/${SPIN_INTERVAL.godlike}`;
}

/** Каждый спин +1 ко всем счётчикам; приз — по порогу (не по общему номеру спина) */
function advanceSpinAndGetWinner() {
    const c = loadCounters();

    c.total += 1;
    c.blue += 1;
    c.epic += 1;
    c.legendary += 1;
    c.mythical += 1;
    c.godlike += 1;

    let winner;

    if (c.godlike >= SPIN_INTERVAL.godlike) {
        winner = getPrizeByRarity("godlike");
        c.godlike = 0;
        c.mythical = 0;
        localStorage.removeItem(STORAGE_ABO_CLAIMED);
    } else if (c.mythical >= SPIN_INTERVAL.mythical) {
        c.mythical = 0;
        if (!localStorage.getItem(STORAGE_ABO_CLAIMED)) {
            winner = getPrizeByRarity("mythical");
            localStorage.setItem(STORAGE_ABO_CLAIMED, "1");
        }
    }

    if (!winner && c.legendary >= SPIN_INTERVAL.legendary) {
        winner = getPrizeByRarity("legendary");
        c.legendary = 0;
    }

    if (!winner && c.epic >= SPIN_INTERVAL.epic) {
        winner = getPrizeByRarity("epic");
        c.epic = 0;
    }

    if (!winner && c.blue >= SPIN_INTERVAL.rare) {
        winner = pickBluePrize();
        c.blue = 0;
    }

    if (!winner) {
        winner = pickGrayPrize();
    }

    saveCounters(c);
    updateSpinUI(c);

    return { winner, spinNum: c.total };
}

function getPrizeByRarity(rarity) {
    const prize = PRIZES.find(p => p.rarity === rarity);
    return prize ? { ...prize } : { ...GRAY_PRIZES[0] };
}

function pickFromPool(pool) {
    const totalWeight = pool.reduce((sum, p) => sum + p.basicWeight, 0);
    let random = Math.random() * totalWeight;
    for (const prize of pool) {
        random -= prize.basicWeight;
        if (random <= 0) return { ...prize };
    }
    return { ...pool[0] };
}

function pickGrayPrize() {
    return pickFromPool(GRAY_PRIZES);
}

function pickBluePrize() {
    return pickFromPool(BLUE_PRIZES);
}

/** Декор ленты — только фиолет / красный / золото (розовая не мигает «как выигрыш») */
function pickTapeDecoPrize() {
    const r = Math.random();
    if (r < 0.45) return getPrizeByRarity("epic");
    if (r < 0.75) return getPrizeByRarity("mythical");
    return getPrizeByRarity("godlike");
}

function getRandomStripPrize() {
    const r = Math.random();
    if (r < 0.18) return pickTapeDecoPrize();
    if (r < 0.62) return pickGrayPrize();
    return pickBluePrize();
}

function getStripPrizeForIndex(index, winnerIndex, winner) {
    if (index === winnerIndex) return winner;

    const dist = Math.abs(index - winnerIndex);
    if (dist >= 1 && dist <= 6) {
        const r = Math.random();
        if (r < 0.28) return pickTapeDecoPrize();
        if (r < 0.55) return pickBluePrize();
        return pickGrayPrize();
    }

    return getRandomStripPrize();
}

function getItemSubLabel(prize) {
    return prize?.note || prize.name;
}

function createItemElement(prize) {
    const el = document.createElement("div");
    el.className = `roulette-item rarity-${prize.rarity}`;
    el.innerHTML = `
            <div class="item-icon">${prize.icon}</div>
            <div class="item-name">${prize.name}</div>
            <div class="item-sub">${getItemSubLabel(prize)}</div>
    `;
    return el;
}

function buildStrip(winner) {
    rouletteTrack.innerHTML = "";

    for (let i = 0; i < STRIP_LENGTH; i++) {
        const prize = getStripPrizeForIndex(i, WIN_INDEX, winner);
        rouletteTrack.appendChild(createItemElement(prize));
    }
}

function getTargetOffset() {
    const itemWidth = getItemWidth();
    const viewportCenter = rouletteViewport.offsetWidth / 2;
    const itemCenter = WIN_INDEX * itemWidth + itemWidth / 2;
    const jitter = (Math.random() - 0.5) * (itemWidth * 0.06);
    return viewportCenter - itemCenter + jitter;
}

const RARITY_LABELS = {
    common: "Серая",
    rare: "Синяя",
    epic: "Фиолетовая",
    legendary: "Розовая",
    mythical: "Красная",
    godlike: "Золотая"
};

function buildLegend() {
    prizesLegend.innerHTML = PRIZES.map(p =>
        `<span class="legend-item rarity-${p.rarity}" title="${RARITY_LABELS[p.rarity]}">${p.icon} ${p.name}</span>`
    ).join("");
}

function showIdleStrip() {
    rouletteTrack.innerHTML = "";
    setTrackX(0);

    const idlePrizes = [...PRIZES, ...PRIZES];
    idlePrizes.forEach(prize => {
        rouletteTrack.appendChild(createItemElement(prize));
    });
}

function highlightWinner() {
    rouletteTrack.querySelectorAll(".roulette-item").forEach(el => el.classList.remove("winner"));
    const winnerEl = rouletteTrack.children[WIN_INDEX];
    if (winnerEl) winnerEl.classList.add("winner");
}

function finishSpin(winner) {
    isSpinning = false;
    openBtn.disabled = false;
    stopSpinSound();
    highlightWinner();

    resultTitle.textContent = "🎉 Ваш приз:";
    const prizeText = winner.note
        ? `${winner.icon} ${winner.name} (${winner.note})`
        : `${winner.icon} ${winner.name} — бесплатно`;
    resultPrize.textContent = prizeText;
    resultPrize.classList.add("win-glow");
    setTimeout(() => resultPrize.classList.remove("win-glow"), 2000);

    caseIcon.classList.add("shake");
    setTimeout(() => caseIcon.classList.remove("shake"), 500);

    if (winner.rarity === "epic" || winner.rarity === "legendary" || winner.rarity === "mythical" || winner.rarity === "godlike") {
        resultTitle.textContent = "🔥 ЭПИЧЕСКИЙ ВЫИГРЫШ! 🔥";
    }
}

function openCase() {
    if (isSpinning) return;

    isSpinning = true;
    openBtn.disabled = true;
    resultTitle.textContent = "Крутим...";
    resultPrize.textContent = "";

    const { winner } = advanceSpinAndGetWinner();
    buildStrip(winner);

    caseIcon.classList.add("shake");
    setTimeout(() => caseIcon.classList.remove("shake"), 400);

    const startX = 0;
    const targetX = getTargetOffset();

    setTrackX(startX);
    playSpinSound();

    requestAnimationFrame(() => {
        animateStrip(startX, targetX, SPIN_DURATION, () => finishSpin(winner));
    });
}

openBtn.addEventListener("click", openCase);
caseIcon.addEventListener("click", () => { if (!isSpinning) openCase(); });

buildLegend();
showIdleStrip();
updateSpinUI(loadCounters());


const WIN_INDEX = 52;
const STRIP_LENGTH = 60;
const SPIN_DURATION = 5000;

const PRIZES = [
    { name: "15 минут",              hours: 0.25, rarity: "common",    icon: "⏳", basicWeight: 24 },
    { name: "30 минут",              hours: 0.5,  rarity: "common",    icon: "⏳", basicWeight: 24 },
    { name: "1 час",                 hours: 1,    rarity: "rare",      icon: "🕐", basicWeight: 18 },
    { name: "1,5 часа",              hours: 1.5,  rarity: "rare",      icon: "🕐", basicWeight: 16 },
    { name: "2 часа + адреналин",    hours: 2,    rarity: "rare",      icon: "⚡", basicWeight: 14 },
    { name: "3 часа + Red Bull",     hours: 3,    rarity: "epic",      icon: "🥤" },
    { name: "5 часов+ Red Bull",     hours: 5,    rarity: "legendary", icon: "💎" },
    { name: "Абонемент 12 часов",    hours: 12,   rarity: "mythical",  icon: "🎫", note: "1 раз за цикл (до 100-го спина)" },
    { name: "24 часа",               hours: 24,   rarity: "godlike",   icon: "👑" }
];

const SPIN_INTERVAL = { rare: 5, epic: 20, legendary: 30, mythical: 50, godlike: 100 };
const STORAGE_SPIN_COUNT = "f1club_spin_count";
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

let isSpinning = false;
let activeAnimation = null;

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

function getSpinCount() {
    return parseInt(localStorage.getItem(STORAGE_SPIN_COUNT) || "0", 10);
}

function incrementSpinCount() {
    const next = getSpinCount() + 1;
    localStorage.setItem(STORAGE_SPIN_COUNT, String(next));
    return next;
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

/** Приоритет: 100 → 50 → 30 → 20 → 5 (синий) → остальное серое */
function determineWinner(spinNum) {
    if (spinNum % SPIN_INTERVAL.godlike === 0) {
        localStorage.removeItem(STORAGE_ABO_CLAIMED);
        return getPrizeByRarity("godlike");
    }

    if (spinNum % SPIN_INTERVAL.mythical === 0) {
        if (!localStorage.getItem(STORAGE_ABO_CLAIMED)) {
            localStorage.setItem(STORAGE_ABO_CLAIMED, "1");
            return getPrizeByRarity("mythical");
        }
    }

    if (spinNum % SPIN_INTERVAL.legendary === 0) {
        return getPrizeByRarity("legendary");
    }

    if (spinNum % SPIN_INTERVAL.epic === 0) {
        return getPrizeByRarity("epic");
    }

    if (spinNum % SPIN_INTERVAL.rare === 0) {
        return pickBluePrize();
    }

    return pickGrayPrize();
}

/** Декор ленты: фиолетовый / красный / золотой (не влияет на реальный приз) */
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

function getHoursLabel(hours, prize) {
    if (prize?.note) return prize.note;
    if (hours === 0.25) return "15 мин";
    if (hours === 0.5) return "30 мин";
    if (hours === 1) return "1 час";
    if (hours === 1.5) return "1,5 часа";
    if (hours >= 2 && hours <= 4) return `${hours} часа`;
    return `${hours} часов`;
}

function createItemElement(prize) {
    const el = document.createElement("div");
    el.className = `roulette-item rarity-${prize.rarity}`;
    el.innerHTML = `
            <div class="item-icon">${prize.icon}</div>
            <div class="item-name">${prize.name}</div>
            <div class="item-sub">${getHoursLabel(prize.hours, prize)}</div>
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
    highlightWinner();

    resultTitle.textContent = "🎉 Ваш приз:";
    resultPrize.textContent = winner.note
        ? `${winner.icon} ${winner.name} (${winner.note})`
        : `${winner.icon} ${winner.name} — бесплатно`;
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

    const spinNum = incrementSpinCount();
    const winner = determineWinner(spinNum);
    buildStrip(winner);

    caseIcon.classList.add("shake");
    setTimeout(() => caseIcon.classList.remove("shake"), 400);

    const startX = 0;
    const targetX = getTargetOffset();

    setTrackX(startX);

    requestAnimationFrame(() => {
        animateStrip(startX, targetX, SPIN_DURATION, () => finishSpin(winner));
    });
}

openBtn.addEventListener("click", openCase);
caseIcon.addEventListener("click", () => { if (!isSpinning) openCase(); });

buildLegend();
showIdleStrip();

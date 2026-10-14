const WIN_INDEX = 52;
const STRIP_LENGTH = 60;
const SPIN_DURATION = 8500;

const PRIZES = [
    { name: "20 бонусов", icon: "⏳", sub: "20 бонусов", weight: 30, rarity: "common" },
    { name: "30 бонусов", icon: "⏳", sub: "30 бонусов", weight: 22, rarity: "common" },
    { name: "110 бонусов", icon: "🕐", sub: "110 бонусов", weight: 8, rarity: "rare" },
    { name: "120 бонусов", icon: "🕐", sub: "120 бонусов", weight: 8, rarity: "rare" },
    { name: "130 бонусов", icon: "🕐", sub: "130 бонусов", weight: 8, rarity: "rare" },
    { name: "390 бонусов", icon: "💰", sub: "390 бонусов", weight: 6, rarity: "legendary" },
    { name: "290 бонусов", icon: "🥤", sub: "290 бонусов", weight: 3, rarity: "legendary" },
    { name: "400 бонусов", icon: "💎", sub: "400 бонусов", weight: 2, rarity: "mythical" },
    { name: "600 бонусов", icon: "💎", sub: "600 бонусов", weight: 2, rarity: "mythical" },
    { name: "1000 бонусов", icon: "🎫", sub: "1000 бонусов", weight: 1, rarity: "godlike" }
];

const DROP_EVERY = [
    { every: 201, rarity: "godlike" },
    { every: 107, rarity: "red" },
    { every: 67, rarity: "mythical" },
    { every: 33, rarity: "legendary" },
    { every: 7, rarity: "rare" }
];

const spinSound = new Audio("go-new-gambling.mp3");
spinSound.preload = "auto";

function playSpinSound() {
    spinSound.pause();
    spinSound.currentTime = 0;
    const playback = spinSound.play();
    if (playback) playback.catch(() => {});
}

function stopSpinSound() {
    spinSound.pause();
    spinSound.currentTime = 0;
}

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
    if (!first) return 158;
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

function getRandomPrize() {
    const pool = PRIZES.filter(prize => prize.weight > 0);
    const totalWeight = pool.reduce((sum, prize) => sum + prize.weight, 0);
    let random = Math.random() * totalWeight;
    for (const prize of pool) {
        random -= prize.weight;
        if (random <= 0) return { ...prize };
    }
    return { ...pool[0] };
}

function nextSpinNumber() {
    const key = "f1-case-spins";
    const next = Number(localStorage.getItem(key) || 0) + 1;
    localStorage.setItem(key, String(next));
    return next;
}

function pickFromRarity(rarity) {
    const pool = PRIZES.filter(prize => prize.rarity === rarity);
    return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function rollPrize() {
    const spin = nextSpinNumber();
    const tier = DROP_EVERY.find(rule => spin % rule.every === 0);
    if (tier) return pickFromRarity(tier.rarity);
    return pickFromRarity("common");
}

function createItemElement(prize) {
    const el = document.createElement("div");
    el.className = `roulette-item rarity-${prize.rarity}`;
    el.innerHTML = `
        <div class="item-icon">${prize.icon}</div>
        <div class="item-name">${prize.name}</div>
        <div class="item-sub">${prize.sub}</div>
    `;
    return el;
}

function buildStrip(winner) {
    rouletteTrack.innerHTML = "";

    for (let i = 0; i < STRIP_LENGTH; i++) {
        const prize = i === WIN_INDEX ? winner : getRandomPrize();
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

function buildLegend() {
    prizesLegend.innerHTML = PRIZES.map(p =>
        `<span class="legend-item rarity-${p.rarity}">${p.icon} ${p.name}</span>`
    ).join("");
}

let centeredIndex = PRIZES.length;

function centerTrack(index) {
    const itemWidth = getItemWidth();
    if (!itemWidth) return;
    const viewportCenter = rouletteViewport.offsetWidth / 2;
    const itemCenter = index * itemWidth + itemWidth / 2;
    setTrackX(viewportCenter - itemCenter);
}

function showIdleStrip() {
    rouletteTrack.innerHTML = "";

    const idlePrizes = [...PRIZES, ...PRIZES];
    idlePrizes.forEach(prize => {
        rouletteTrack.appendChild(createItemElement(prize));
    });

    centeredIndex = PRIZES.length;
    requestAnimationFrame(() => centerTrack(centeredIndex));
}

function highlightWinner() {
    rouletteTrack.querySelectorAll(".roulette-item").forEach(el => el.classList.remove("winner"));
    const winnerEl = rouletteTrack.children[WIN_INDEX];
    if (winnerEl) winnerEl.classList.add("winner");
}

function finishSpin(winner) {
    isSpinning = false;
    centeredIndex = WIN_INDEX;
    openBtn.disabled = false;
    highlightWinner();

    const isEpic = winner.rarity === "mythical" || winner.rarity === "red" || winner.rarity === "godlike";
    if (resultTitle) {
        resultTitle.textContent = isEpic ? "🔥 Эпический выигрыш" : "🎉 Ваш приз:";
    }
    if (resultPrize) {
        resultPrize.textContent = `${winner.icon} ${winner.name} — бесплатно`;
        resultPrize.classList.add("win-glow");
        setTimeout(() => resultPrize.classList.remove("win-glow"), 2000);
    }

    stopSpinSound();
    caseIcon.classList.add("shake");
    setTimeout(() => caseIcon.classList.remove("shake"), 500);
}

function openCase() {
    if (isSpinning) return;

    isSpinning = true;
    openBtn.disabled = true;
    if (resultTitle) resultTitle.textContent = "Крутим...";
    if (resultPrize) resultPrize.textContent = "";

    const winner = rollPrize();
    buildStrip(winner);

    playSpinSound();
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

window.addEventListener("resize", () => {
    if (isSpinning) return;
    centerTrack(centeredIndex);
});

buildLegend();
showIdleStrip();

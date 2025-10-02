const iconHeight = 79;
    const icons = ["seven","banana","melon","lemon","bar","bell","orange","plum","cherry"];
    const numIcons = icons.length;

    const symbolMap = {
      "7️⃣": "seven",
      "🍌": "banana",
      "🍉": "melon",
      "🍋": "lemon",
      "🟥": "bar",
      "🔔": "bell",
      "🍊": "orange",
      "🍑": "plum",
      "🍒": "cherry",
    };

    const reelEls = [
      document.getElementById("reel1"),
      document.getElementById("reel2"),
      document.getElementById("reel3")
    ];

    const reelTopIndex = [0,0,0];
    reelEls.forEach(r => {
      r.style.backgroundRepeat = "repeat-y";
      r.style.backgroundPositionY = "0px";
      r.style.transition = "none";
    });

    let spinning = false;
    let currentBet = 5;     // mise par défaut
    let currentBalance = 0; // sera synchronisé avec le serveur

    function selectBet(amount) {
      currentBet = amount;
      document.querySelectorAll(".bet-buttons button").forEach(btn => btn.classList.remove("active"));
      event.target.classList.add("active");
    }

    function startSpin() {
      if (spinning) return;
      spin(currentBet);
    }

    function rollTo(reelIdx, finalEmoji, delayIdx) {
      return new Promise(resolve => {
        const reel = reelEls[reelIdx];
        const targetName = symbolMap[finalEmoji] || "cherry";
        const targetIndex = icons.indexOf(targetName);

        const targetTopIndex = ((targetIndex - 1) + numIcons) % numIcons;
        const currentTop = reelTopIndex[reelIdx];
        const deltaSteps = ((targetTopIndex - currentTop) + numIcons) % numIcons;

        const extraTurns = 3 + delayIdx;
        const totalSteps = extraTurns * numIcons + deltaSteps;

        const fromPx = currentTop * iconHeight;
        const toPx   = fromPx + totalSteps * iconHeight;

        const durationMs = 900 + delayIdx * 350;

        requestAnimationFrame(() => {
          reel.style.transition = `background-position-y ${durationMs}ms cubic-bezier(.41,-0.01,.63,1.09)`;
          reel.style.backgroundPositionY = `${toPx}px`;
        });

        setTimeout(() => {
          reel.style.transition = "none";
          const normalized = (targetTopIndex * iconHeight) % (numIcons * iconHeight);
          reel.style.backgroundPositionY = `${normalized}px`;
          reelTopIndex[reelIdx] = targetTopIndex;

          playReelStop(); // 🔊 son à l’arrêt du rouleau

          resolve();
        }, durationMs + 30);
      });
    }

    function spin(bet) {
      if (spinning) return;
      spinning = true;

      // 💰 Débit immédiat côté client
      currentBalance -= bet;
      document.getElementById("balance").textContent = currentBalance;

      // Message en cours
      document.getElementById("spinResult").textContent = "🎰 Les rouleaux tournent 🎰";

      fetch("/casino-backend/slots", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "bet=" + encodeURIComponent(bet)
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          spinning = false;
          document.getElementById("spinResult").textContent = "❌ " + data.error;
          return;
        }

        Promise.all([
          rollTo(0, data.symbols[0], 0),
          rollTo(1, data.symbols[1], 1),
          rollTo(2, data.symbols[2], 2),
        ]).then(() => {
          // ✅ synchronise avec la valeur réelle du serveur
          currentBalance = data.newCredits;
          document.getElementById("balance").textContent = currentBalance;

          // ✅ Affiche le résultat avec son associé
          if (data.gain > 0) {
            document.getElementById("spinResult").textContent = "Gain: " + data.gain;
            playWin(); // 🔊 son gain
          } else {
            document.getElementById("spinResult").textContent = "💀 Perdu 💀";
            playLose(); // 🔊 son perte
          }

          spinning = false;
        });
      })
      .catch(err => {
        spinning = false;
        document.getElementById("spinResult").textContent = "❌ Erreur réseau : " + err;
      });
    }

    // Active la mise 5 par défaut
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelector(".bet-buttons button").classList.add("active");
    });

    // === Gestion des sons ===
    const bgMusic = document.getElementById("bgMusic");
    bgMusic.volume = 0.6; // volume faible (10%)

    const reelStopSound = document.getElementById("reelStopSound");
    const winSound = document.getElementById("winSound");
    const loseSound = document.getElementById("loseSound");

    let musicEnabled = false;

    // Toggle musique
    document.getElementById("toggleMusic").addEventListener("click", () => {
      if (musicEnabled) {
        bgMusic.pause();
        musicEnabled = false;
      } else {
        bgMusic.play();
        musicEnabled = true;
      }
    });

    // 🔊 Joue un son quand un rouleau s'arrête
    function playReelStop() {
      reelStopSound.currentTime = 0;
      reelStopSound.play();
    }

    // 🔊 Joue le son de gain
    function playWin() {
      winSound.currentTime = 0;
      winSound.play();
    }

    // 🔊 Joue le son de perte
    function playLose() {
      loseSound.currentTime = 0;
      loseSound.play();
      }
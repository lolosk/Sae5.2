class SlotScene extends Phaser.Scene {
  constructor() {
    super("slot");
  }

  preload() {
    this.load.image("wifi", "../imgs/slot/wifi-signal.png");
    this.load.image("rj45", "/imgs/slot/rj45.png");
    this.load.image("router", "/imgs/slot/routeur.png");
    this.load.image("server", "../imgs/slot/server.png");
    this.load.image("firewall", "../imgs/slot/firewall.png");
    this.load.image("fiber", "../imgs/slot/optical-fiber.png");
    this.load.image("antenna", "../imgs/slot/antena.png");
    this.load.image("fiveg", "../imgs/slot/5G.png");
    this.load.image("doc", "../imgs/slot/documentation.png");
  }


  create() {
    this.add.image(400, 300, "wifi").setScale(0.3);
    this.add.text(220, 20, "🎰 Slot Réseaux", { fontSize: "32px", fill: "#fff" });

    // Crée un tableau des clés
    this.symbolKeys = ["wifi","rj45","router","server","firewall","fiber","antenna","fiveg","doc"];

    // Ajoute les symboles en colonne
    this.reelGroup = this.add.group();
    let y = 100;
    for (let i = 0; i < this.symbolKeys.length; i++) {
      let sprite = this.add.image(150, y, this.symbolKeys[i]).setScale(0.2);
      this.reelGroup.add(sprite);
      y += 100; // espace vertical
    }

    // Bouton SPIN
    this.spinBtn = this.add.text(350, 500, "SPIN", { fontSize: "28px", fill: "#0f0" })
      .setInteractive()
      .on("pointerdown", () => this.spin());
  }


  spin() {
    // Fait défiler le groupe vers le bas
    this.tweens.add({
      targets: this.reelGroup.getChildren(),
      y: "+=300", // descend de 300px
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => {
        console.log("Spin terminé !");
      }
    });
  }

}

// Config Phaser
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#222",
  parent: "game-container",
  scene: [SlotScene]
};

new Phaser.Game(config);

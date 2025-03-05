// Global game variable (will be initialized after Start Game is pressed)
let game = null;
// Variable to track swipe gesture start position
let swipeStart = null;

document.addEventListener('DOMContentLoaded', () => {
  const menuOverlay = document.getElementById('menu-overlay');
  const startButton = document.getElementById('start-button');

  startButton.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    setTimeout(() => {
      menuOverlay.style.display = 'none';
    }, 500);
    launchPhaserGame();
  });
});

/**
 * Launch the Phaser game using Matter.js physics.
 * BootScene reads localStorage to resume the correct level.
 */
function launchPhaserGame() {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    physics: {
      default: 'matter',
      matter: {
        gravity: { y: 1 },
        debug: false
      }
    },
    scene: [BootScene, Level1Scene, Level2Scene, Level3Scene]
  };

  game = new Phaser.Game(config);
  window.addEventListener('resize', () => {
    if (game && game.scale) {
      game.scale.resize(window.innerWidth, window.innerHeight);
    }
  });
}

/* ---------------------------------------------------
   BootScene: Reads saved level from localStorage
--------------------------------------------------- */
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }
  create() {
    let currentLevel = localStorage.getItem('currentLevel') || 'Level1Scene';
    console.log('Resuming from level:', currentLevel);
    this.scene.start(currentLevel);
  }
}

/* ---------------------------------------------------
   Helper: Check if two line segments intersect
--------------------------------------------------- */
function segmentsIntersect(p, p2, q, q2) {
  function ccw(A, B, C) {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  }
  return (ccw(p, q, q2) !== ccw(p2, q, q2)) && (ccw(p, p2, q) !== ccw(p, p2, q2));
}

/* ---------------------------------------------------
   Level1Scene (previous level) – unchanged from before
--------------------------------------------------- */
class Level1Scene extends Phaser.Scene {
  constructor() {
    super('Level1Scene');
  }
  preload() {
    this.load.image('bg', 'assets/background.png');
    this.load.image('person', 'assets/person.png');
    this.load.audio('cutSound', 'assets/cut.mp3');
    this.load.audio('completeSound', 'assets/complete.mp3');
  }
  create() {
    const { width, height } = this.cameras.main;
    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
    bg.setDisplaySize(width, height);
    this.matter.world.setBounds(0, 0, width, height);
    const anchorX = width / 2;
    const anchorY = 50;
    this.anchorBody = this.matter.add.rectangle(anchorX, anchorY, 10, 10, { isStatic: true });
    this.person = this.matter.add.image(anchorX, anchorY + 100, 'person');
    this.person.setDisplaySize(80, 120);
    this.person.setBounce(0.2);
    this.person.setFriction(0.05);
    this.ropeConstraint = this.matter.add.constraint(
      this.anchorBody,
      this.person.body,
      150,
      1.9
    );
    this.ropeGraphics = this.add.graphics();
    this.cutSound = this.sound.add('cutSound');
    this.completeSound = this.sound.add('completeSound');

    this.input.on('pointerdown', (pointer) => {
      swipeStart = { x: pointer.x, y: pointer.y };
    });
    this.input.on('pointerup', (pointer) => {
      if (!swipeStart) return;
      const swipeEnd = { x: pointer.x, y: pointer.y };
      const ropeStart = { x: this.anchorBody.position.x, y: this.anchorBody.position.y };
      const ropeEnd = { x: this.person.body.position.x, y: this.person.body.position.y };
      if (segmentsIntersect(swipeStart, swipeEnd, ropeStart, ropeEnd)) {
        this.cutRope();
      }
      swipeStart = null;
    });
    const cutRopeBtn = document.getElementById('cut-rope-btn');
    cutRopeBtn.addEventListener('click', () => {
      this.cutRope();
    });
  }
  cutRope() {
    if (this.ropeConstraint) {
      this.matter.world.removeConstraint(this.ropeConstraint);
      this.ropeConstraint = null;
      this.cutSound.play();
      localStorage.setItem('currentLevel', 'Level2Scene');
      const completeText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Level 1 Completed!', {
        font: '40px Poppins',
        fill: '#FFFFFF',
        backgroundColor: '#000000'
      }).setOrigin(0.5);
      this.completeSound.play();
      this.time.delayedCall(2000, () => {
        this.scene.start('Level2Scene');
      });
    }
  }
  update() {
    this.ropeGraphics.clear();
    if (this.ropeConstraint) {
      const posA = this.anchorBody.position;
      const posB = this.person.body.position;
      this.ropeGraphics.lineStyle(4, 0xff4b2b, 1);
      this.ropeGraphics.beginPath();
      this.ropeGraphics.moveTo(posA.x, posA.y);
      this.ropeGraphics.lineTo(posB.x, posB.y);
      this.ropeGraphics.strokePath();
    }
  }
}

/* ---------------------------------------------------
   Level2Scene: New Level with Moving Platform
--------------------------------------------------- */
class Level2Scene extends Phaser.Scene {
  constructor() {
    super('Level2Scene');
    this.levelCompleted = false;
  }

  preload() {
    // Load assets – ensure these files exist in your assets folder.
    this.load.image('bg', 'assets/background.png');
    this.load.image('person', 'assets/person.png');
    this.load.image('platform', 'assets/platform.png');
    this.load.audio('successSound', 'assets/success.mp3');
    this.load.audio('failSound', 'assets/fail.mp3');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background setup
    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
    bg.setDisplaySize(width, height);
    this.matter.world.setBounds(0, 0, width, height);

    // Create anchor for rope
    const anchorX = width / 2;
    const anchorY = 50;
    this.anchorBody = this.matter.add.rectangle(anchorX, anchorY, 10, 10, { isStatic: true });

    // Create the person (player)
    this.person = this.matter.add.image(anchorX, anchorY + 100, 'person');
    this.person.setDisplaySize(80, 120);
    this.person.setBounce(0.2);
    this.person.setFriction(0.05);

    // Attach the person to the anchor with a rope constraint
    this.ropeConstraint = this.matter.add.constraint(
      this.anchorBody,
      this.person.body,
      150,   // rope length
      0.9    // rope stiffness
    );

    // Graphics object to visually draw the rope
    this.ropeGraphics = this.add.graphics();

    // Create a moving platform near the bottom of the screen
    this.platform = this.matter.add.sprite(width * 0.25, height - 50, 'platform', null, { isStatic: true });
    this.platform.setDisplaySize(150, 30);
    this.tweens.add({
      targets: this.platform,
      x: width * 0.75,
      ease: 'Linear',
      duration: 3000,
      yoyo: true,
      repeat: -1
    });

    // Instruction text
    this.add.text(20, 20, 'Swipe to cut the rope at the right time!', {
      font: '20px Poppins',
      fill: '#FFFFFF'
    });

    // Set up pointer events for swipe detection
    this.input.on('pointerdown', (pointer) => {
      swipeStart = { x: pointer.x, y: pointer.y };
    });
    this.input.on('pointerup', (pointer) => {
      if (!swipeStart) return;
      const swipeEnd = { x: pointer.x, y: pointer.y };
      const ropeStart = { x: this.anchorBody.position.x, y: this.anchorBody.position.y };
      const ropeEnd = { x: this.person.body.position.x, y: this.person.body.position.y };
      if (segmentsIntersect(swipeStart, swipeEnd, ropeStart, ropeEnd)) {
        this.cutRope();
      }
      swipeStart = null;
    });

    // Accessible "Cut Rope" button (from the HTML)
    const cutRopeBtn = document.getElementById('cut-rope-btn');
    cutRopeBtn.addEventListener('click', () => this.cutRope());

    // Collision detection: if the person lands on the platform, complete the level.
   // Collision detection: if the person lands on the platform, complete the level.
this.matter.world.on('collisionstart', (event) => {
  event.pairs.forEach((pair) => {
    let bodies = [pair.bodyA, pair.bodyB];

    // Check if the collision is between the person and the platform
    if (bodies.includes(this.person.body) && bodies.includes(this.platform.body)) {
      // Ensure the person is actually landing (not just touching briefly)
      const velocityY = Math.abs(this.person.body.velocity.y); // Get downward velocity
      const personBottom = this.person.y + this.person.displayHeight / 2; // Bottom of the player
      const platformTop = this.platform.y - this.platform.displayHeight / 2; // Top of the platform

      if (velocityY < 2 && personBottom >= platformTop) {
        // Low vertical speed & actually above the platform -> Successfully landed
        this.levelComplete();
      }
    }
  });
});


    // Initialize audio; these sound objects will be used safely.
    this.successSound = this.sound.add('successSound');
    this.failSound = this.sound.add('failSound');
  }

  update() {
    // Clear and redraw the rope
    this.ropeGraphics.clear();
    if (this.ropeConstraint) {
      const posA = this.anchorBody.position;
      const posB = this.person.body.position;
      this.ropeGraphics.lineStyle(4, 0xff4b2b, 1);
      this.ropeGraphics.beginPath();
      this.ropeGraphics.moveTo(posA.x, posA.y);
      this.ropeGraphics.lineTo(posB.x, posB.y);
      this.ropeGraphics.strokePath();
    }
    // Check if the person has fallen off the bottom of the screen
    if (this.person.y > this.cameras.main.height && !this.levelCompleted) {
      this.levelFail();
    }
  }

  cutRope() {
    if (this.ropeConstraint) {
      this.matter.world.removeConstraint(this.ropeConstraint);
      this.ropeConstraint = null;
    }
  }

  levelComplete() {
    if (!this.levelCompleted) {
      this.levelCompleted = true;
      // Safely play the success sound if available
      if (this.successSound) this.successSound.play();
      this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Level 2 Completed!', {
        font: '40px Poppins',
        fill: '#FFFFFF',
        backgroundColor: '#000000'
      }).setOrigin(0.5);
      localStorage.setItem('currentLevel', 'Level3Scene');
      this.time.delayedCall(2000, () => {
        this.scene.start('Level3Scene');
      });
    }
  }

  levelFail() {
    if (!this.levelCompleted) {
      this.levelCompleted = true;
      if (this.failSound) this.failSound.play();
      this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Try Again!', {
        font: '40px Poppins',
        fill: '#FF0000',
        backgroundColor: '#000000'
      }).setOrigin(0.5);
      this.time.delayedCall(2000, () => {
        this.scene.restart();
      });
    }
  }



  

}


/* ---------------------------------------------------
   Level3Scene: Stub for Next Level
--------------------------------------------------- */
class Level3Scene extends Phaser.Scene {
  constructor() {
    super('Level3Scene');
  }
  create() {
    const { width, height } = this.cameras.main;
    this.add.text(width / 2, height / 2, 'Level 3 - Coming Soon!', {
      font: '40px Poppins',
      fill: '#FFFFFF'
    }).setOrigin(0.5);
    localStorage.setItem('currentLevel', 'Level3Scene');
  }
}

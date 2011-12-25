// Blood Splatters!

define(['Game', 'Sprite', 'Vector'], function (Game, Sprite, Vector) {
  var maxLife = 60; // seconds

  var currentSplats = [];
  var maxSplats     = 25; // number of splats on the screen at a time

  var Splatter = function (pos, color, str) {
    this.pos     = pos;
    this.pos.rot = 0;
    this.color   = color;
    this.life    = 0;
    this.dots    = [];
    this.z       = 1;

    str = str || 0;

    this.createSplats(str);
    this.createNode();
    this.drawSplatter();
  };
  Splatter.prototype = new Sprite();
  Splatter.prototype.stationary = true;
  Splatter.prototype.fx         = true;

  Splatter.prototype.createSplats = function (strength) {
    var upperLeft  = new Vector(Number.MAX_VALUE, Number.MAX_VALUE);
    var lowerRight = new Vector(-Number.MAX_VALUE, -Number.MAX_VALUE);

    // always need at least one
    var count = Math.round(Math.random() * 5) + strength + 1;

    for (var i = 0; i < count; i++) {
      var vector = new Vector(360 * Math.random());
      vector.scale(Math.random() * 5);
      vector.size = Math.round(Math.random() * 2) + 1;
      this.dots.push(vector);
      // find the upper and lower bounds
      upperLeft.x  = Math.min(upperLeft.x, vector.x);
      upperLeft.y  = Math.min(upperLeft.y, vector.y);
      lowerRight.x = Math.max(lowerRight.x, vector.x + vector.size);
      lowerRight.y = Math.max(lowerRight.y, vector.y + vector.size);
    }

    var offset = upperLeft.multiply(-1);
    this.center = offset;

    for (i = 0; i < count; i++) {
      this.dots[i].translate(offset);
    }

    lowerRight.translate(offset);

    // set the tile size from our bounding calculation
    this.tileWidth  = lowerRight.x;
    this.tileHeight = lowerRight.y;
  };

  Splatter.prototype.createNode = function () {
    this.node = $('<canvas/>').attr('width', this.tileWidth).attr('height', this.tileHeight);
    this.node.addClass('sprite');
    this.node.css('z-index', this.z);

    // add a spin to the whole affair
    this.pos.rot = 360 * Math.random();

    this.spriteParent.append(this.node);
  };

  Splatter.prototype.postMove = function (delta) {
    this.life += delta;
    if (this.life > maxLife) {
      this.die();
    }
  };

  Splatter.prototype.draw = function () {
    this.node[0].style.opacity = 1 - this.life / maxLife;
  };

  Splatter.prototype.drawSplatter = function () {
    var context = this.node[0].getContext('2d');
    context.fillStyle = this.color;
    context.shadowBlur = 1;
    var count = this.dots.length;
    for (var i = 0; i < count; i++) {
      var vector = this.dots[i];
      context.fillRect(vector.x, vector.y, vector.size, vector.size);
    }
  };

  var splat = function (pos, color, strength) {
    var splatter = new Splatter(pos, color, strength);
    Game.sprites.push(splatter);
    // keep track of existing splats
    currentSplats.push(splatter);
    if (currentSplats.length > maxSplats) {
      var reclaimed = currentSplats.shift();
      reclaimed.die();
    }
  };

  return {
    splat: splat
  };
});
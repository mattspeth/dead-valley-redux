// Sprite

define(["game", "Matrix", "Vector", "eventmachine", "spritemarshal", "Sprite-info", "fx/BulletHit"],
       function (game, Matrix, Vector, eventMachine, spriteMarshal, spriteInfo, BulletHit) {

  var Matrix  = new Matrix(2, 3);

  var spriteParent = $('#canvas');

  var bulletHit;

  var Sprite = function () {
    this.visible  = true;
    this.reap     = false;

    this.collidable = false;

    this.scale = 1;

    this.currentNode = null;
    this.nextsprite  = null;
  };

  // this sprite should be saved when the level chunk in reclaimed
  Sprite.prototype.shouldSave = true;

  Sprite.prototype.init = function (name) {
    var config = spriteInfo[name];

    this.name   = name;

    var co;
    if (config.collidableOffset) {
      co = config.collidableOffset;
    } else {
      // if not configured assume it's centered
      co = new Vector(config.width / 2, config.height / 2);
    }
    this.points = [
      new Vector(-co.x, -co.y),
      new Vector( co.x, -co.y),
      new Vector( co.x,  co.y),
      new Vector(-co.x,  co.y)
    ];

    // assuming horizontal tiles
    this.tileWidth  = config.width;
    this.tileHeight = config.height;

    // cloned so we can manipulate it on a per-sprite instance basis
    this.imageOffset = $.extend({}, config.imageOffset);
    this.center      = $.extend({}, config.center);

    // load the image
    // game.assetManager.loadImage(config.img, $.proxy(function (img) {
    //   this.image = img;
    // }, this));

    this.image = config.img;

    this.pos = new Vector(0, 0);
    this.pos.rot = 0;

    this.vel = new Vector(0, 0);
    this.vel.rot = 0;

    this.acc = new Vector(0, 0);
    this.acc.rot = 0;

    // for now we're going to assume all sprites are boxes
    // TODO calculate the normals for arbitrary shapes
    this.normals = [
      new Vector(1, 0),
      new Vector(0, 1)
    ];

    this.currentNormals = [
      new Vector(1, 0),
      new Vector(0, 1)
    ];

    // sprites default to a z-index of 100
    this.z = config.z || 100;

    this.createNode();
  };

  Sprite.prototype.createNode = function () {
    this.node = $('<div/>');
    this.node.css({
      'background-image': "url(assets/"+this.image+".png)",
      'z-index': this.z,
      width: this.tileWidth,
      height: this.tileHeight
    });
    this.node.addClass('sprite');
    spriteParent.append(this.node);
  };

  Sprite.prototype.preMove  = function () {
  };

  Sprite.prototype.postMove = function () {
  };

  Sprite.prototype.run = function (delta) {
    this.transPoints = null; // clear cached points
    this.preMove(delta);
    this.move(delta);
    this.postMove(delta);
    this.transformNormals();
    this.updateGrid();
  };

  Sprite.prototype.move = function (delta) {
    if (!this.visible) return;

    this.vel.x   += this.acc.x   * delta;
    this.vel.y   += this.acc.y   * delta;
    this.vel.rot += this.acc.rot * delta;
    this.pos.x   += this.vel.x   * delta;
    this.pos.y   += this.vel.y   * delta;
    this.pos.rot += this.vel.rot * delta;

    if (this.pos.rot > 360) {
      this.pos.rot -= 360;
    } else if (this.pos.rot < 0) {
      this.pos.rot += 360;
    }
  };

  // TODO: cache these
  Sprite.prototype.transformNormals = function () {
    // only rotate
    Matrix.configure(this.pos.rot, 1.0, 0, 0);
    for (var i = 0; i < this.normals.length; i++) {
      this.currentNormals[i] = Matrix.vectorMultiply(this.normals[i]);
    }
  };

  Sprite.prototype.render = function (delta) {
    if (!this.visible) return;

    var map = game.map;

    var x = this.pos.x - map.originOffsetX;
    var y = this.pos.y - map.originOffsetY;

    var transform = [];
    transform.push(' translate(', -this.center.x, 'px,', -this.center.y, 'px)');
    transform.push(' translate(', x, 'px,', y, 'px)');
    transform.push(' rotate(', this.pos.rot, 'deg)');
    if (this.direction) {
      transform.push(' scaleX(-1)');
    }

    // TODO support FF
    this.node[0].style['-webkit-transform'] = transform.join('');

    this.draw();
  };

  // default draw method, just draw the 0th tile
  Sprite.prototype.draw = function (delta) {
    this.drawTile(0);
  };

  Sprite.prototype.updateGrid = function () {
    if (!this.visible) return;
    var newNode = game.map.getNodeByWorldCoords(this.pos.x, this.pos.y);

    // we're off the the part of the world loaded into memory
    if (!newNode) {
      this.die();
      return;
    }

    if (newNode !== this.currentNode) {
      if (this.currentNode) {
        this.currentNode.leave(this);
      }
      newNode.enter(this);
      this.currentNode = newNode;
    }
  };

  Sprite.prototype.collision = function () {
  };

  Sprite.prototype.hide = function () {
    this.visible = false;
    this.node.hide();
  };

  Sprite.prototype.show = function () {
    this.visible = true;
    this.node.show();
  };

  Sprite.prototype.die = function () {
    this.reap = true;
    if (this.currentNode) {
      this.currentNode.leave(this);
      this.currentNode = null;
    }
    this.node.remove();
  };

  // TODO perhaps cache transpoints Vectors?
  Sprite.prototype.transformedPoints = function () {
    if (this.transPoints) return this.transPoints;
    var trans = [];
    Matrix.configure(this.pos.rot, this.scale, this.pos.x, this.pos.y);
    var count = this.points.length;
    for (var i = 0; i < count; i++) {
      trans[i] = Matrix.vectorMultiply(this.points[i]);
    }
    this.transPoints = trans; // cache translated points
    return trans;
  };

  Sprite.prototype.isClear = function (pos) {
    pos = pos || this.pos;
    var cn = this.currentNode;
    if (cn == null) {
      var gridx = Math.floor(pos.x / game.gridsize);
      var gridy = Math.floor(pos.y / game.gridsize);
      gridx = (gridx >= game.map.grid.length) ? 0 : gridx;
      gridy = (gridy >= game.map.grid[0].length) ? 0 : gridy;
      cn = game.map.grid[gridx][gridy];
    }
    return (cn.isEmpty(this.collidesWith) &&
            cn.north.isEmpty(this.collidesWith) &&
            cn.south.isEmpty(this.collidesWith) &&
            cn.east.isEmpty(this.collidesWith) &&
            cn.west.isEmpty(this.collidesWith) &&
            cn.north.east.isEmpty(this.collidesWith) &&
            cn.north.west.isEmpty(this.collidesWith) &&
            cn.south.east.isEmpty(this.collidesWith) &&
            cn.south.west.isEmpty(this.collidesWith));
  };

  // TODO handle vertical offsets
  Sprite.prototype.drawTile = function (index, flipped) {
    var left = -(index % this.tileWidth) * this.tileWidth - this.imageOffset.x;
    var top  = -this.imageOffset.y;
    this.node[0].style['background-position']  = [left, 'px ', top, 'px'].join('');
  };

  Sprite.prototype.nearby = function () {
    if (this.currentNode == null) return [];
    return _(this.currentNode.nearby()).without(this);
  };

  Sprite.prototype.distance = function (other) {
    return Math.sqrt(Math.pow(other.pos.x - this.pos.x, 2) + Math.pow(other.pos.y - this.pos.y, 2));
  };

  // take a relative Vector and make it a world Vector
  Sprite.prototype.relativeToWorld = function (relative) {
    Matrix.configure(this.pos.rot, 1.0, 0, 0);
    return Matrix.vectorMultiply(relative);
  };
  // take a world Vector and make it a relative Vector
  Sprite.prototype.worldToRelative = function (world) {
    Matrix.configure(-this.pos.rot, 1.0, 0, 0);
    return Matrix.vectorMultiply(world);
  };

  Sprite.prototype.saveMetadata = function () {
    return {
      clazz: this.name,
      pos:   this.pos
    };
  };

  Sprite.prototype.bulletHit = function (hit, damage) {
    if (!bulletHit) {
      bulletHit = new BulletHit();
    }
    bulletHit.fireSparks(hit);
  };

  spriteMarshal(Sprite);
  eventMachine(Sprite);

  return Sprite;
});

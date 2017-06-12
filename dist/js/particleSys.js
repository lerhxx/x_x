'use strict';

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Sprite = function () {
	function Sprite() {
		var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_classCallCheck(this, Sprite);

		this.x = args.x || 0;
		this.y = args.y || 0;
		this.vx = args.vx || 0;
		this.vy = args.vy || 0;
		this.ax = args.ax || 0;
		this.ay = args.ay || 0;
	}

	_createClass(Sprite, [{
		key: 'moveTo',
		value: function moveTo(x, y) {
			this.x = x;
			this.y = y;
		}
	}, {
		key: 'update',
		value: function update() {
			this.vx += this.ax;
			this.vy += this.ay;

			this.x += this.vx;
			this.y += this.vy;
		}
	}, {
		key: 'render',
		value: function render() {
			return true;
		}
	}]);

	return Sprite;
}();

var Particle = function (_Sprite) {
	_inherits(Particle, _Sprite);

	function Particle(args) {
		_classCallCheck(this, Particle);

		var _this = _possibleConstructorReturn(this, (Particle.__proto__ || Object.getPrototypeOf(Particle)).call(this, args));

		_this.owner = args.owner;
		_this.r = args.r || 10;
		_this.color = args.color || 'black';

		_this.adjust = _this.adjust.bind(_this);
		return _this;
	}

	_createClass(Particle, [{
		key: 'update',
		value: function update() {
			_get(Particle.prototype.__proto__ || Object.getPrototypeOf(Particle.prototype), 'update', this).call(this);
			if (this.x < this.r || this.x + this.r > this.owner.w) {
				this.vx *= -1;
				this.x = this.adjust(0, this.owner.w, this.x);
			}

			if (this.y < this.r || this.y + this.r > this.owner.h) {
				this.vy *= -1;
				this.y = this.adjust(0, this.owner.h, this.y);
			}
		}
	}, {
		key: 'render',
		value: function render(ctx) {
			ctx.beginPath();
			ctx.fillStyle = this.color;
			ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, false);
			ctx.closePath();
			ctx.fill();
		}
	}, {
		key: 'adjust',
		value: function adjust(min, max, v) {
			return v > max ? max : v < min ? min : v;
		}
	}]);

	return Particle;
}(Sprite);

var ParticleSys = function () {
	function ParticleSys() {
		_classCallCheck(this, ParticleSys);

		this.canvas = document.getElementById('canvas');
		this.ctx = this.canvas.getContext('2d');

		this.canvas.width = document.body.scrollWidth;
		this.canvas.height = document.body.scrollHeight;

		this.w = this.canvas.width;
		this.h = this.canvas.height;
		this.threshold = this.canvas.width / 12;
		this.mouse = null;

		this.nodes = [];
		this.edges = [];
		this.counter = null;

		this.bindEvent();
		this.render = this.render.bind(this);

		this.init();
		this.render();
	}

	_createClass(ParticleSys, [{
		key: 'init',
		value: function init() {
			for (var i = 0; i < 350; ++i) {
				var vx = Math.random() - .5,
				    vy = Math.random() - .5,
				    r = MathUtil(1, 5);

				var node = new Particle({
					x: MathUtil(10, this.w),
					y: MathUtil(10, this.h),
					vx: vx == 0 ? .1 : vx,
					vy: vy == 0 ? .1 : vy,
					owner: this,
					r: Math.random() > 0.95 ? r + 0.5 : r,
					color: 'white'
				});
				this.nodes.push(node);
			}

			for (var _i = 0, len = this.nodes.length; _i < len; ++_i) {
				for (var n = _i + 1; n < len; ++n) {
					this.edges.push({
						from: this.nodes[_i],
						to: this.nodes[n]
					});
				}
			}
		}
	}, {
		key: 'renderEdges',
		value: function renderEdges(edge) {
			var l = this.lengthOfEdge(edge);
			if (l > this.threshold) {
				return;
			}
			this.ctx.beginPath();
			this.ctx.strokeStyle = 'white';
			this.ctx.lineWidth = (1 - l / this.threshold) * 2.5;
			this.ctx.globalAlpha = 1 - l / this.threshold;
			this.ctx.moveTo(edge.from.x, edge.from.y);
			this.ctx.lineTo(edge.to.x, edge.to.y);
			this.ctx.stroke();
			this.ctx.closePath();
		}
	}, {
		key: 'update',
		value: function update() {
			for (var i = 0, len = this.nodes.length; i < len; ++i) {
				this.nodes[i].update();
			}
		}
	}, {
		key: 'render',
		value: function render() {
			// this.ctx.fillStyle = 'black';
			this.ctx.clearRect(0, 0, this.w, this.h);

			this.update();

			for (var i = 0, len = this.nodes.length; i < len; ++i) {
				this.ctx.save();
				this.nodes[i].render(this.ctx);
				this.ctx.restore();
			}

			for (var _i2 = 0, _len = this.edges.length; _i2 < _len; ++_i2) {
				this.ctx.save();
				this.renderEdges(this.edges[_i2]);
				this.ctx.restore();
				this.ctx.globalAlpha = 1.0;
			}
			requestAnimationFrame(this.render);
		}
	}, {
		key: 'bindEvent',
		value: function bindEvent() {
			var _this2 = this;

			this.canvas.addEventListener('mouseenter', function (e) {
				return _this2.mouserEnter(e);
			});
			this.canvas.addEventListener('mousemove', function (e) {
				return _this2.mouseMove(e);
			});
			this.canvas.addEventListener('mouseleave', function (e) {
				return _this2.mouseLeave();
			});
			window.onresize = function () {
				clearTimeout(_this2.counter);
				_this2.counter = setTimeout(function () {
					_this2.canvas.width = document.body.scrollWidth;
					_this2.canvas.height = document.body.scrollHeight;
					_this2.render();
					console.log(document.body.scrollHeight);
				}, 1500);
			};
		}
	}, {
		key: 'mouserEnter',
		value: function mouserEnter(e) {
			this.mouse = this.nodes[0];
		}
	}, {
		key: 'mouseMove',
		value: function mouseMove(e) {
			this.mouse.x = e.offsetX;
			this.mouse.y = e.offsetY;
		}
	}, {
		key: 'mouseLeave',
		value: function mouseLeave() {
			this.mouse = null;
		}
	}, {
		key: 'lengthOfEdge',
		value: function lengthOfEdge(edge) {
			var w = Math.abs(edge.from.x - edge.to.x),
			    h = Math.abs(edge.from.y - edge.to.y);
			return Math.sqrt(w * w + h * h);
		}
	}]);

	return ParticleSys;
}();

window.onload = function () {
	new ParticleSys();
};

function MathUtil() {
	var a = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	var b = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

	return Math.floor(Math.random() * (b - a) + a);
}
class Sprite {
	constructor(args={}) {
		this.x = args.x || 0;
		this.y = args.y || 0;
		this.vx = args.vx || 0;
		this.vy = args.vy || 0;
		this.ax = args.ax || 0;
		this.ay = args.ay || 0;
	}

	moveTo(x, y) {
		this.x = x;
		this.y = y;
	}

	update() {
		this.vx += this.ax;
		this.vy += this.ay;

		this.x += this.vx;
		this.y += this.vy;
	}

	render() {
		return true;
	}
}

class Particle extends Sprite{
	constructor(args) {
		super(args);
		this.owner = args.owner;
		this.r = args.r || 10;
		this.color = args.color || 'black';

		this.adjust = this.adjust.bind(this);
	}

	update() {
		super.update();
		if(this.x < this.r || this.x + this.r > this.owner.w) {
			this.vx *= -1;
			this.x = this.adjust(0, this.owner.w, this.x);
		}

		if(this.y < this.r || this.y + this.r > this.owner.h) {
			this.vy *= -1;
			this.y = this.adjust(0, this.owner.h, this.y);
		}
	}

	render(ctx) {
		ctx.beginPath();
		ctx.fillStyle = this.color;
		ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, false);
		ctx.closePath();
		ctx.fill();
	}

	adjust(min, max, v) {
		return v > max ? max : (v < min ? min : v);
	}
}

class ParticleSys {
	constructor() {
		this.canvas = document.getElementById('canvas');
		this.ctx = this.canvas.getContext('2d');

		this.canvas.width = window.innerWidth;
		this.canvas.height = 400;

		this.w = this.canvas.width;
		this.h = this.canvas.height;
		this.threshold = this.canvas.width / 12;
		this.mouse = null;

		this.nodes = [];
		this.edges = [];

		this.bindEvent();
		this.render = this.render.bind(this);

		this.init();
		this.render();
	}

	init() {
		for(let i = 0; i < 200; ++i) {
			let vx = Math.random() - .5,
				vy = Math.random() - .5,
				r = MathUtil(1, 5);

			let node = new Particle({
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

		for(let i = 0, len = this.nodes.length; i < len; ++i) {
			for(let n = i + 1; n < len; ++n) {
				this.edges.push({
					from: this.nodes[i],
					to: this.nodes[n]
				})
			}
		}
	}

	renderEdges(edge) {
		let l = this.lengthOfEdge(edge);
		if(l > this.threshold) {
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

	update() {
		for(let i = 0, len = this.nodes.length; i < len; ++i) {
			this.nodes[i].update();
		}
	}

	render() {
		// this.ctx.fillStyle = 'black';
		this.ctx.clearRect(0, 0, this.w, this.h);

		this.update();

		for(let i = 0, len = this.nodes.length; i < len; ++i) {
			this.ctx.save();
			this.nodes[i].render(this.ctx);
			this.ctx.restore();
		}

		for(let i = 0, len = this.edges.length; i < len; ++i) {
			this.ctx.save();
			this.renderEdges(this.edges[i]);
			this.ctx.restore();
			this.ctx.globalAlpha = 1.0
		}
		requestAnimationFrame(this.render);
	}

	bindEvent() {
		this.canvas.addEventListener('mouseenter', (e) => this.mouserEnter(e))
		this.canvas.addEventListener('mousemove', (e) => this.mouseMove(e))
		this.canvas.addEventListener('mouseleave', (e) => this.mouseLeave())
	}

	mouserEnter(e) {
		this.mouse = this.nodes[0];
	}

	mouseMove(e) {
		this.mouse.x = e.offsetX;
		this.mouse.y = e.offsetY;
	}

	mouseLeave() {
		this.mouse = null;
	}

	lengthOfEdge(edge) { 
		let w = Math.abs(edge.from.x - edge.to.x),
			h = Math.abs(edge.from.y - edge.to.y);
		return Math.sqrt(w * w + h * h);
	}
}

window.onload = () => {
	new ParticleSys();
}

function MathUtil(a = 0, b = 1) {
	return Math.floor(Math.random() * (b - a) + a);
}
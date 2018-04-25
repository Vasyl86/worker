// console.log("hello!  dd");

function run(fn) {
	var blob = new Blob(['('+fn+')()']);
	var ur = URL.createObjectURL(blob);
	return new Worker(ur);
}

console.time("prepare data");
var data = JSON.stringify(prepareBigData());
console.timeEnd("prepare data");
console.log(data.length);

function startWorker() {
	console.time("startWorker");
	// var worker = new Worker("work.js");
	
	var worker = run(someWorker);
	
	var time = Date.now();
	
	worker.postMessage({time: time, data: data});
	
	worker.onmessage = function(event) {
		console.log(event.data);
		worker.onmessage = null;
		worker = null;
	}
	console.timeEnd("startWorker");
}


function someWorker() {
	addEventListener('message', function(e) {
		
		function prepareBigData() {
			var num = 3000000;
			var output = [];
			for (var i = 0; i < num; i++){
				if (i % 10000 === 0) {
					console.log(i);
					output.length = 0;
				}
				output.push(prepareComplicatedObject());
			}
			return output;
		}
		
		function prepareComplicatedObject() {
			var out = {};
			var randomProps = Math.round(2 + Math.random() * 20);
			for (var i = 0; i < randomProps; i++){
				out[Math.random().toString(36).replace(/[^a-z]+/g, '')] = Math.random().toString(36).replace(/[^a-z]+/g, '');
			}
			return out;
		}
		var timeout = Date.now() - e.data.time;
		console.time("prepare data worker");
		prepareBigData();
		console.timeEnd("prepare data worker");
		
		self.postMessage("Worker received data: " + timeout);
		self.close();
	}, false);
}

Filters = {};
Filters.getPixels = function(img) {
	var c = this.getCanvas(img.width, img.height);
	var ctx = c.getContext('2d');
	ctx.drawImage(img);
	return ctx.getImageData(0,0,c.width,c.height);
};

Filters.getCanvas = function(w,h) {
	var c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return c;
};

Filters.filterImage = function(filter, image, var_args) {
	var args = [this.getPixels(image)];
	for (var i=2; i<arguments.length; i++) {
		args.push(arguments[i]);
	}
	return filter.apply(null, args);
};

Filters.greyscale = function(pixels, args) {
	var d = pixels.data;
	for (var i=0; i<d.length; i+=4) {
		var r = d[i];
		var g = d[i+1];
		var b = d[i+2];
		// CIE luminance for the RGB
		// The human eye is bad at seeing red and blue, so we de-emphasize them.
		var v = 0.2126*r + 0.7152*g + 0.0722*b;
		d[i] = d[i+1] = d[i+2] = v
	}
	return pixels;
};

Filters.brightness = function(pixels, adjustment) {
	var d = pixels.data;
	for (var i=0; i<d.length; i+=4) {
		d[i] += adjustment;
		d[i+1] += adjustment;
		d[i+2] += adjustment;
	}
	return pixels;
};

Filters.threshold = function(pixels, threshold) {
	var d = pixels.data;
	for (var i=0; i<d.length; i+=4) {
		var r = d[i];
		var g = d[i+1];
		var b = d[i+2];
		var v = (0.2126*r + 0.7152*g + 0.0722*b >= threshold) ? 255 : 0;
		d[i] = d[i+1] = d[i+2] = v
	}
	return pixels;
};

Filters.tmpCanvas = document.createElement('canvas');
Filters.tmpCtx = Filters.tmpCanvas.getContext('2d');

Filters.createImageData = function(w,h) {
	return this.tmpCtx.createImageData(w,h);
};

Filters.convolute = function(pixels, weights, opaque) {
	var side = Math.round(Math.sqrt(weights.length));
	var halfSide = Math.floor(side/2);
	var src = pixels.data;
	var sw = pixels.width;
	var sh = pixels.height;
	// pad output by the convolution matrix
	var w = sw;
	var h = sh;
	var output = Filters.createImageData(w, h);
	var dst = output.data;
	// go through the destination image pixels
	var alphaFac = opaque ? 1 : 0;
	for (var y=0; y<h; y++) {
		for (var x=0; x<w; x++) {
			var sy = y;
			var sx = x;
			var dstOff = (y*w+x)*4;
			// calculate the weighed sum of the source image pixels that
			// fall under the convolution matrix
			var r=0, g=0, b=0, a=0;
			for (var cy=0; cy<side; cy++) {
				for (var cx=0; cx<side; cx++) {
					var scy = sy + cy - halfSide;
					var scx = sx + cx - halfSide;
					if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
						var srcOff = (scy*sw+scx)*4;
						var wt = weights[cy*side+cx];
						r += src[srcOff] * wt;
						g += src[srcOff+1] * wt;
						b += src[srcOff+2] * wt;
						a += src[srcOff+3] * wt;
					}
				}
			}
			dst[dstOff] = r;
			dst[dstOff+1] = g;
			dst[dstOff+2] = b;
			dst[dstOff+3] = a + alphaFac*(255-a);
		}
	}
	return output;
};

var greyscale = Filters.filterImage(Filters.greyscale, image);
// Note that ImageData values are clamped between 0 and 255, so we need
// to use a Float32Array for the gradient values because they
// range between -255 and 255.
var vertical = Filters.convoluteFloat32(grayscale,
	[ -1, 0, 1,
		-2, 0, 2,
		-1, 0, 1 ]);
var horizontal = Filters.convoluteFloat32(grayscale,
	[ -1, -2, -1,
		0,  0,  0,
		1,  2,  1 ]);
var final_image = Filters.createImageData(vertical.width, vertical.height);
for (var i=0; i<final_image.data.length; i+=4) {
	// make the vertical gradient red
	var v = Math.abs(vertical.data[i]);
	final_image.data[i] = v;
	// make the horizontal gradient green
	var h = Math.abs(horizontal.data[i]);
	final_image.data[i+1] = h;
	// and mix in some blue for aesthetics
	final_image.data[i+2] = (v+h)/4;
	final_image.data[i+3] = 255; // opaque alpha
}



	
// 	// postMessage('I am a worker!');
// 	// setInterval(function () {
// 	// 	postMessage('I am a worker! 333');
// 	// }, 1000);

// function prepareBigData() {
// 	var num = 300000;
// 	var output = [];
// 	for (var i = 0; i < num; i++){
// 		output.push(prepareComplicatedObject());
// 	}
// 	return output;
// }

// function prepareComplicatedObject() {
// 	var out = {};
// 	var randomProps = Math.round(2 + Math.random() * 20);
// 	for (var i = 0; i < randomProps; i++){
// 		out[Math.random().toString(36).replace(/[^a-z]+/g, '')] = Math.random().toString(36).replace(/[^a-z]+/g, '');
// 	}
// 	return out;
// }
	
// 	onmessage = function(evt) {
// 		var timeout = Date.now() - evt.data.time;
// 		console.time("prepare data worker");
// 		prepareBigData();
// 		console.timeEnd("prepare data worker");

// 		postMessage("Worker received data: " + timeout);
// 	}
	
// 	// self.close();
// });




var j = 0;

setInterval(function (argument) {
	j++;
	// console.log("do oyher ", j);
	// console.time("dom operation");
	document.getElementById("stre").innerHTML = "do oyher " + j;
	// console.timeEnd("dom operation");
}, 500);



function prepareBigData() {
	var num = 3000;
	var output = [];
	for (var i = 0; i < num; i++){
		output.push(prepareComplicatedObject());
	}
	return output;
}

function prepareComplicatedObject() {
	var out = {};
	var randomProps = Math.round(2 + Math.random() * 20);
	for (var i = 0; i < randomProps; i++){
		out[Math.random().toString(36).replace(/[^a-z]+/g, '')] = Math.random().toString(36).replace(/[^a-z]+/g, '');
	}
	return out;
}
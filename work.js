addEventListener('message', function(e) {

function prepareBigData() {
	var num = 300000;
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
var timeout = Date.now() - e.data.time;
		console.time("prepare data worker");
		prepareBigData();
		console.timeEnd("prepare data worker");

    self.postMessage("Worker received data: " + timeout);
    self.close();
}, false);
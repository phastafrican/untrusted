
// directions for moving entities
var keys = {
	37: 'left',
	38: 'up',
	39: 'right',
	40: 'down'
};

var levelFileNames = [
	'blocks.js',
	'theReturnOfBlocks.js',
	'levelThree.js',
	'multiplicity.js',
	'traps.js',
    'trees.js',
];

var display;
var output;
var editor;
var map;

var currentLevel = 0; // level numbers start at 0 because coding :\

function init() {
	display = new ROT.Display({
		width: dimensions.width,
		height: dimensions.height,
		fontFamily: '"droid sans mono", monospace',
		fontSize: 20,
		// fontStyle: "bold"
	});

	// drawObject takes care of looking up an object's symbol and color
	// according to name (NOT according to the actual object literal!)
	display.drawObject = function (x, y, object, bgColor, multiplicand) {
		var symbol = objects[object].symbol;
		var color;
		if (objects[object].color) {
			color = objects[object].color;
		} else {
			color = "#fff";
		}

		if (!bgColor) {
			bgColor = "#000";
		}

		if (multiplicand) {
			color = ROT.Color.toHex(ROT.Color.multiply(multiplicand, ROT.Color.fromString(color)));
			bgColor = ROT.Color.toHex(ROT.Color.multiply(multiplicand, ROT.Color.fromString(bgColor)));
		}

		display.draw(x, y, symbol, color, bgColor);
	};

	display.drawAll = function(map, multiplicand) {
		for (var x = 0; x < dimensions.width; x++) {
			for (var y = 0; y < dimensions.height; y++) {
				this.drawObject(x, y, map._grid[x][y].type, map._grid[x][y].bgColor, multiplicand);
			}
		}
		if (map.player) { map.player.draw(); }

	}

	display.fadeOut = function (map, callback, i) {
		if (i <= 0) {
			if (callback) { callback(); }
		} else {
			if (!i) { i = 255; }
			this.drawAll(map, [i, i, i]);
			setTimeout(function () { display.fadeOut(map, callback, i-10); }, 10);
		}
	};

	display.fadeIn = function (map, callback, i) {
		if (i > 255) {
			if (callback) { callback(); }
		} else {
			if (!i) { i = 0; }
			this.drawAll(map, [i, i, i]);
			setTimeout(function () { display.fadeIn(map, callback, i+5); }, 10);
		}
	};

	$('#screen').append(display.getContainer());

	// required so all canvas elements can detect keyboard events
	$("canvas").first().attr("contentEditable", "true");
	display.getContainer().addEventListener("keydown", function(e) {
		if (keys[e.keyCode]) {
			map.player.move(keys[e.keyCode]);
		}
	});
	display.getContainer().addEventListener("click", function(e) {
		$(display.getContainer()).addClass('focus');
		$('.CodeMirror').removeClass('focus');
	});

	output = new ROT.Display({width: dimensions.width * 1.33, height: 2, fontSize: 15});
	$('#output').append(output.getContainer());
	output.write = function(text) {
		output.clear();
		output.drawText(0, 0, text);
	}

	map = new Map(display);
	getLevel(currentLevel);
	focusOnMap();
}

function moveToNextLevel() {
	currentLevel++;
	display.fadeOut(map, function () {
		getLevel(currentLevel);
	})
};

// makes an ajax request to get the level text file and
// then loads it into the game
function getLevel(levelNumber) {
	var fileName;
	if (levelNumber < levelFileNames.length) {
		fileName = levelFileNames[levelNumber];
	}
	else {
		fileName = "dummyLevel.js";
	}
	$.get('levels/' + fileName, function (codeText) {
		if (editor) {
			editor.toTextArea();
		}
		loadLevel(codeText, levelNumber);
	});
}

function loadLevel(lvlCode, lvlNum) {
	// initialize CodeMirror editor
    editor = createEditor("editor", lvlCode, 600, 500);
	editor.on("focus", function(instance) {
		$('.CodeMirror').addClass('focus');
		$('#screen canvas').removeClass('focus');
	});

	// initialize level
	editor.setValue(lvlCode);

	// get editable line ranges from level metadata
	levelMetadata = editor.getLine(0);
	editableLineRanges = JSON.parse(levelMetadata.slice(3)).editable;
	editableLines = [];
	for (var j = 0; j < editableLineRanges.length; j++) {
		range = editableLineRanges[j];
		for (var i = range[0]; i <= range[1]; i++) {
			editableLines.push(i - 1);
		}
	}
	editor.removeLine(0);

	// only allow editing on editable lines, and don't allow removal of lines
	// also, set a line length limit of 80 chars
	editor.on('beforeChange', function (instance, change) {
		if (editableLines.indexOf(change.to.line) == -1 ||
				change.to.line != change.from.line ||
				(change.to.ch > 80 && change.to.ch >= change.from.ch)) {
			change.cancel();
		}
	});

	// set bg color for uneditable line
	editor.on('update', function (instance) {
		for (var i = 0; i < editor.lineCount(); i++) {
			if (editableLines.indexOf(i) == -1) {
				instance.addLineClass(i, 'wrap', 'disabled');
			}
		}
	});
	editor.refresh();

	// editor.getPlayerCode returns only the code written in editable lines
	editor.getPlayerCode = function () {
		var code = '';
		for (var i = 0; i < editor.lineCount(); i++) {
			if (editableLines.indexOf(i) > -1) {
				code += editor.getLine(i) + ' \n';
			}
		}
		return code;
	}

	// start the level and fade in
	evalLevelCode(lvlNum);
	if (lvlNum < levelFileNames.length) {
		// don't fade in for dummy level
		display.fadeIn(map);
	}

	// on first level, display intro text
	if (currentLevel == 0) {
		output.write('Dr. Eval awoke in a strange dungeon, with no apparent way out. He spied his trusty computer ...');
	}
}

function focusOnMap() {
	$('canvas').first().attr('tabindex', '0').click().focus();
}

function focusOnEditor() {
	editor.focus();
}

function resetEditor() {
    getLevel(currentLevel);
}

function evalLevelCode(lvlNum) {
	var allCode = editor.getValue();
	var playerCode = editor.getPlayerCode();
	var validatedStartLevel = validate(allCode, playerCode, currentLevel);
	if (validatedStartLevel) {
		map.reset();
		validatedStartLevel(map);
		if (lvlNum >= levelFileNames.length) {
			// don't do this for dummy level
			return;
		}
		display.drawAll(map);
	}
}

function usePhone() {
	if (map.player._phoneFunc) {
		map.player._phoneFunc();
	} else {
		output.write('RotaryPhoneException: Your function phone is not bound to any function.')
	}
}

shortcut.add('ctrl+1', focusOnMap);
shortcut.add('ctrl+2', focusOnEditor);
shortcut.add('ctrl+4', resetEditor);
shortcut.add('ctrl+5', evalLevelCode);
shortcut.add('ctrl+6', usePhone);

// Editor object

var createEditor = function (domElemId, levelCode, width, height) {

    var ed = CodeMirror.fromTextArea(document.getElementById(domElemId),
            { theme: 'vibrant-ink', 
            lineNumbers: true,
            dragDrop: false,
            extraKeys: {'Enter': function () {}}
            }); 
    ed.setSize(width, height); //TODO this line causes wonky cursor behavior, might be a bug in CodeMirror?
    ed.setValue(levelCode);
    return ed;
};
var dimensions = {
	width: 50,
	height: 25
};

var Map = function (display) {
	this.reset = function () {
		this._display.clear();
		this._grid = new Array(dimensions.width);
		for (var x = 0; x < dimensions.width; x++) {
			this._grid[x] = new Array(dimensions.height);
			for (var y = 0; y < dimensions.height; y++) {
				this._grid[x][y] = {type: 'empty'};
			}
		}
		this.player = null;
	};

	this.getWidth = function () { return dimensions.width; }
	this.getHeight = function () { return dimensions.height; }

	this.placeObject = function (x, y, type, bgColor) {
        if (typeof(this._grid[x]) !== 'undefined' && typeof(this._grid[x][y]) !== 'undefined') {
            if (!this.player.atLocation(x, y) || type == 'empty') {
                this._grid[x][y].type = type;
            }
        }
	};

	this.placePlayer = function (x, y) {
		if (this.player) {
			throw "Can't place player twice!";
		}
		this.player = new Player(x, y, this);
	};

	this.setSquareColor = function (x, y, bgColor) {
		this._grid[x][y].bgColor = bgColor;
	};

	this.canMoveTo = function (x, y) {
		if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
			return false;
		}
		return objects[map._grid[x][y].type].passable;
	};

	// Initialize with empty grid
	this._display = display;
	this.reset();
};
var pickedUpComputer = false;
var pickedUpPhone = false;

var objects = {
	'empty' : {
		'symbol': ' ',
		'passable': true
	},
	'block': {
		'symbol': '#',
		'color': '#f00',
		'passable': false
	},
	'tree': {
		'symbol': '♣',
		'color': '#080',
		'passable': false
	},
	'trap': {
		'symbol': ' ',
		'passable': true,
		'onCollision': function (player) {
			player.killedBy('an invisible trap');
		}
	},
    'stream': {
        'symbol': '░',
        'passable': true,
        'onCollision': function (player) {
            player.killedBy('drowning in deep dark water');
        }
    },
	'exit' : {
		'symbol' : String.fromCharCode(0x2395), // ⎕
		'color': '#0ff',
		'passable': true,
		'onCollision': function (player) {
			moveToNextLevel();
		}
	},
	'player' : {
		'symbol': '@',
		'color': '#0f0',
		'passable': false
	},
	'computer': {
		'symbol': String.fromCharCode(0x2318), // ⌘
		'color': '#ccc',
		'passable': true,
		'onCollision': function (player) {
			player.pickUpItem();
			pickedUpComputer = true;
			output.write('You have picked up the computer! You can use it to get past the walls to the exit.');
			$('#editorPane').fadeIn();
			editor.refresh();
		}
	},
	'phone': {
		'symbol': String.fromCharCode(0x260E), // ☎
		'passable': true,
		'onCollision': function (player) {
			player.pickUpItem();
			pickedUpPhone = true;
			output.write('You have picked up the function phone! You can use it to call functions, as defined by setPhoneCallback in the level code.');
			$('#phoneButton').show();
		}
	}
};
var Player = function(x, y, map) {
	this._x = x;
	this._y = y;
	this._rep = "@";
	this._fgColor = "#0f0";
	this._display = map._display;
	this.draw();
}

Player.prototype.draw = function () {
	var bgColor = map._grid[this._x][this._y].bgColor
	this._display.draw(this._x, this._y, this._rep, this._fgColor, bgColor);
}

Player.prototype.atLocation = function (x, y) {
	return (this._x === x && this._y === y);
}

Player.prototype.move = function (direction) {
	var cur_x = this._x;
	var cur_y = this._y;
	var new_x;
	var new_y;

	if (direction === 'up') {
		new_x = cur_x;
		new_y = cur_y - 1;
	}
	else if (direction === 'down') {
		new_x = cur_x;
		new_y = cur_y + 1;
	}
	else if (direction === 'left') {
		new_x = cur_x - 1;
		new_y = cur_y;
	}
	else if (direction === 'right') {
		new_x = cur_x + 1;
		new_y = cur_y;
	}

	if (map.canMoveTo(new_x, new_y)) {
		this._display.drawObject(cur_x,cur_y, map._grid[cur_x][cur_y].type, map._grid[cur_x][cur_y].bgColor);
		this._x = new_x;
		this._y = new_y;
		this.draw();
		if (objects[map._grid[new_x][new_y].type].onCollision) {
			objects[map._grid[new_x][new_y].type].onCollision(this);
		}
	}
	else {
		console.log("Can't move to " + new_x + ", " + new_y + ", reported from inside Player.move() method");
	}
};

Player.prototype.killedBy = function (killer) {
	alert('You have been killed by ' + killer + '!');
	getLevel(currentLevel);
}

Player.prototype.pickUpItem = function () {
	map.placeObject(this._x, this._y, 'empty');
	// do a little dance to get rid of graphical artifacts //TODO fix this
	this.move('left');
	this.move('right');
}

Player.prototype.setPhoneCallback = function(func) {
    this._phoneFunc = func;
}

var VERBOTEN = ['eval', 'prototype', 'delete', 'return', 'moveToNextLevel'];

var validationRulesByLevel = [ null ];

var DummyDisplay = function () {
	this.clear = function () {};
	this.draw = function () {};
	this.drawObject = function () {};
};

function validate(allCode, playerCode, level) {
	validateLevel = function () {};

	output.clear();
	try {
		for (var i = 0; i < VERBOTEN.length; i++) {
			var badWord = VERBOTEN[i];
			if (playerCode.indexOf(badWord) > -1) {
				throw 'You are not allowed to use ' + badWord + '!';
			}
		}

		var dummyMap = new Map(new DummyDisplay);

		eval(allCode); // get startLevel and (opt) validateLevel methods

		startLevel(dummyMap);
		if (typeof(validateLevel) != 'undefined') {
			validateLevel(dummyMap);
		}

		return startLevel;
	} catch (e) {
		output.drawText(0, 0, e.toString());
	}
}

function validateAtLeastXObjects(map, num, type) {
	var count = 0;
	for (var x = 0; x < map.getWidth(); x++) {
		for (var y = 0; y < map.getHeight(); y++) {
			if (map._grid[x][y].type === type) {
				count++;
			}
		}
	}
	if (count < num) {
		throw 'Not enough ' + type + 's on the map! Expected: ' + num + ', found: ' + count;
	}
}

function validateExactlyXManyObjects(map, num, type) {
	var count = 0;
	for (var x = 0; x < map.getWidth(); x++) {
		for (var y = 0; y < map.getHeight(); y++) {
			if (map._grid[x][y].type === type) {
				count++;
			}
		}
	}
	if (count != num) {
		throw 'Wrong number of ' + type + 's on the map! Expected: ' + num + ', found: ' + count;
	}
}
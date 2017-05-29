//NCESARIO PARA PRODUCCION
const express = require('express');
const nunjucks = require('nunjucks');
const bodyParser = require('body-parser');
const app = express();

//BASE D DATOS
var db = require('./static/js/db.js');

//SESIONES
var session = require('express-session');

//ENCRIPTACION SHA256
var sha256 = require('js-sha256');

//SOCKETIO
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function() {
	console.log('http://localhost:' + port);
});

// Set view engine
app.set('view engine', 'html');
var env = nunjucks.configure('views', {
	autoescape: true,
	express: app
});

app.use(session({
	secret: 'whatisthis',
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false }
}));

// Set views folder
app.set('views', __dirname + '/views');
// Set static files folder
app.use('/static', express.static(__dirname + '/static'));
// Parseh pa kohe balyavreh der foln
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());
// Global variables
env.addGlobal('url', '');

var sess;

//INICIO
app.all('/', function(req, res) {
	sess = req.session;
	//sesion automatica para pruebas
	// sess.userid = 1;
	// sess.user = 'admin';
	// var query = "SELECT name FROM users_chars WHERE user_id=?";
	// 	var query_var = [sess.userid];
	// 	db.Select(query, query_var).then(function(result){
	// 		var size = Object.size(result);
	// 		if(size>0){
	// 			sess.characters = result;
	// 			sess.characters_max = size;
	// 		}else{
	// 			sess.characters = [];
	// 			sess.characters_max = 0;
	// 		}
	// 		res.render('index.html', {
	// 			sess: sess
	// 		});
	// 	});
	//fin inicio automatico descomentar

	res.render('index.html', {
		sess: sess
	});
	delete sess.info;
});
//FIN INICIO

//USUARIOS
//LOGIN
app.post('/login', function(req, res) {
	sess = req.session;

	var user = req.body.username || "";
	var pass = sha256(req.body.password) || "";

	var query_select = "SELECT name, id FROM users WHERE name=? AND password=?";
	var query_select_var = [user, pass];

	var page = req.body.url;

	//LOGUEAMOS
	db.Select(query_select, query_select_var).then(function(result) {
		//SI SE ENCUENTRA EL USUARIO:
		if (typeof result[0] != 'undefined') {
			sess.userid = result[0].id;
			//MIRAMOS SUS PJS CREADOS
			var query = "SELECT name FROM users_chars WHERE user_id=?";
			var query_var = [result[0].id];
			db.Select(query, query_var).then(function(result) {
				var size = Object.size(result);
				sess.user = user;
				if (size > 0) {
					sess.characters = result;
					sess.characters_max = size;
				} else {
					sess.characters = [];
					sess.characters_max = 0;
				}
				res.redirect(page);
			});
			//SI NO
		} else {
			sess.info = "El Usuario no existe";
			sess.infoType = "danger";
			res.redirect(page);
		}

	}).catch((err) => setImmediate(() => { console.log(err); }));

});
//FIN LOGIN
//SIGN UP
app.post('/signup', function(req, res) {

	var user = req.body.username || "";
	var pass = sha256(req.body.password) || "";
	var page = req.body.url;
	sess = req.session;
	if (pass == sha256(req.body.passwordalt)) {
		var query_select = "SELECT name FROM users WHERE name=?";
		var query_select_var = [user];
		var query_insert = "INSERT INTO users (name, password) VALUES (?,?)";
		var query_insert_var = [user, pass];

		db.Select(query_select, query_select_var).then(function(result) {
			if (typeof result[0] != 'undefined') {
				sess.info = "Ya existe un Usuario con ese nombre.";
				sess.infoType = "warning";
				res.redirect(page);
			} else {
				db.Insert(query_insert, query_insert_var).then(function() {
					sess.info = "Usuario creado correctamente. ¡Ya puedes iniciar sesión!";
					sess.infoType = "success";
					sess.characters_max = 0;
					res.redirect(page);
				});
			}

		}).catch((err) => setImmediate(() => { console.log(err); }));
	} else {
		sess.info = "Las contraseñas no coinciden";
		sess.infoType = "warning";
		res.redirect(page);
	}



});
//FIN SIGN UP
//LOGOUT
app.post('/logout', function(req, res) {
	sess = req.session;

	//guardamos los datos del pj
	//       var query = "UPDATE users_chars SET xPos=?, yPos=? WHERE name=?";
	// var query_var = [xPosMia, yPosMia, sess.character_name];
	// db.Select(query, query_var).then(function(){
	delete sess.user;
	delete sess.characters;
	delete sess.characters_max;
	delete sess.userid;
	res.render('index.html', {
		sess: sess
	});
	// });
});
//FIN LOGOUT

//RANKING
app.get('/ranking', function(req, res) {
	sess = req.session;
	var query = "SELECT * FROM users_chars ORDER BY kills DESC LIMIT 10;";
	db.Select(query).then(function(result){
		res.render('ranking.html', {
			sess: sess,
			characters: result
		});
	});
});
//FIN RANKING
//FIN USUARIOS

//SOCKETIO
app.all('/game', function(req, res) {
	sess = req.session;

	if (sess.user) {
		if (sess.character_name) {
			var query = "SELECT * FROM users_chars WHERE name=? LIMIT 1";
			var query_var = [sess.character_name];
			db.Select(query, query_var).then(function(result) {
				sess.character_image = result[0].image;
				sess.character_weapon = result[0].weapon;
				sess.character_head = result[0].head;
				sess.character_xPos = result[0].xPos;
				sess.character_yPos = result[0].yPos;
				sess.character_direction = result[0].direction;
				sess.character_action = result[0].action;
				sess.character_width = result[0].width;
				sess.character_height = result[0].height;
				sess.character_hp = result[0].hp;
				sess.character_attack = result[0].attack;
				sess.character_defense = result[0].defense;
				sess.character_speed = result[0].speed;
				sess.character_sound = result[0].sound;
				res.render('game.html', {
					sess: sess
				});
			});
		} else {
			res.redirect('/');
		}
	} else {
		res.redirect('/');
	}


});

// Chatroom
var numUsers = 0;
var playersonline = [];
var xPosMia;
var yPosMia;
var hpMia;

io.on('connection', function(socket) {
	var addedUser = false;

	// when the client emits 'new message', this listens and executes
	socket.on('new message', function(data) {
		// we tell the client to execute 'new message'
		socket.broadcast.emit('new message', {
			username: socket.username,
			message: data
		});
	});

	// when the client emits 'add user', this listens and executes
	socket.on('add user', function(data) {
		if (addedUser) return;

		// we store the username in the socket session for this client
		socket.username = data.name;
		++numUsers;
		// console.log("Action server: "+data.action);
		playersonline.push({
			name: data.name,
			image: data.image,
			weapon: data.weapon,
			head: data.head,
			xPos: data.xPos,
			yPos: data.yPos,
			direction: data.direction,
			action: data.action,
			width: data.width,
			height: data.height,
			hp: data.hp,
			attack: data.attack,
			defense: data.defense,
			speed: data.speed,
			kills: 0
		});

		xPosMia = data.xPos;
		yPosMia = data.yPos;

		console.log("Añadimos alguien al array: " + JSON.stringify(playersonline));

		// console.log(JSON.stringify(playersonline));

		addedUser = true;
		socket.emit('login', {
			numUsers: numUsers,
			username: socket.username
		});
		// echo globally (all clients) that a person has connected
		socket.broadcast.emit('user joined', {
			username: socket.username,
			numUsers: numUsers,
			playersonline: playersonline
		});
	});

	// when the client emits 'typing', we broadcast it to others
	socket.on('typing', function() {
		socket.broadcast.emit('typing', {
			username: socket.username
		});
	});

	// when the client emits 'stop typing', we broadcast it to others
	socket.on('stop typing', function() {
		socket.broadcast.emit('stop typing', {
			username: socket.username
		});
	});

	socket.on('rotation', function(data) {
		for (var i = playersonline.length - 1; i >= 0; i--) {
			if (playersonline[i].name === data.player.name) {
				playersonline[i].direction = data.player.direction;
			}
		}

		socket.broadcast.emit('someone rotated', { playersonline: playersonline, rotated: data.player });
	});

	socket.on('move', function(data) {
		for (var i = data.playersonline.length - 1; i >= 0; i--) {
			playersonline[i].action = data.playersonline[i].action;
			if (playersonline[i].name === data.player.name) {
				playersonline[i].xPos = data.player.xPos;
				playersonline[i].yPos = data.player.yPos;
				playersonline[i].direction = data.player.direction;
				if (data.player.name === sess.character_name) {
					xPosMia = data.player.xPos;
					yPosMia = data.player.yPos;
				}
			}
		}

		//console.log('Alguien se ha movido y es posible que se haya dibujado: '+JSON.stringify(playersonline));

		socket.broadcast.emit('someone moved', { playersonline: playersonline });
	});

	socket.on('attacking', function(data) {
		for (var i = playersonline.length - 1; i >= 0; i--) {
			if (playersonline[i].name === data.attacker.name) {
				playersonline[i].action = data.attacker.action;
			}
		}
		socket.broadcast.emit('someone attacked', { playersonline: playersonline, attacker: data.attacker });
	});

	socket.on('die', function(data) {
		/*console.log("borramos de aqui: " + JSON.stringify(playersonline));
		console.log("esto: " + JSON.stringify(data.name));
		var name = JSON.stringify(data.name).replace(/"/g, '');*/
		var attackerName = JSON.stringify(data.attacker).replace(/"/g, '');

		for (var i = 0; i < playersonline.length; i++) {
			if (playersonline[i].name == attackerName) playersonline[i].kills += 1;
		}

		/*removeByAttr(playersonline, 'name', name);

		console.log('Borramos al muerto y se queda asi: ' + JSON.stringify(playersonline));*/

		socket.broadcast.emit('someone die', { playersonline: playersonline });
	});

	socket.on('hit', function(data) {
		var enemyHP = parseFloat(JSON.stringify(data.enemy.hp).replace(/"/g, ''));
		var enemyName = JSON.stringify(data.enemy.name).replace(/"/g, '');
		for (var i = playersonline.length - 1; i >= 0; i--) {
			if (playersonline[i].name === enemyName) {
				playersonline[i].hp = enemyHP;
				if (enemyName === sess.character_name) {
					hpMia = enemyHP;
				}
			}
		}

		socket.broadcast.emit('someone hitted', { playersonline: playersonline, enemy: data.enemy, attacker: data.attacker });

	});

	// when the user disconnects.. perform this
	socket.on('disconnect', function() {
		if (addedUser) {
			--numUsers;


			console.log("borramos de aqui: " + JSON.stringify(playersonline));
			console.log("esto: " + socket.username);

			//guardamos los datos del pj
			var query = "SELECT kills FROM users_chars WHERE name=?";
			var query_var = [socket.username];


			db.Select(query, query_var).then(function(result) {
				var sessionKills;
				for (var i = 0; i < playersonline.length; i++) {
					if (playersonline[i].name == socket.username) {
						sessionKills = playersonline[i].kills;
						break;
					}

				}
				if (sessionKills > result[0].kills) {
					var updateQuery = "UPDATE users_chars SET kills=? WHERE name=?";
					var updateQuery_var = [sessionKills, socket.username];

					db.Select(updateQuery, updateQuery_var).then(function(result){
						console.log(result);
					});
				}
				removeByAttr(playersonline, 'name', socket.username);
				console.log('Borramos al deslogueado y se queda asi: ' + JSON.stringify(playersonline));
				// echo globally that this client has left
				socket.broadcast.emit('user left', {
					username: socket.username,
					numUsers: numUsers,
					playersonline: playersonline
				});

			});


		}
	});
});
//FIN SOCKETIO

//PANTALLA DEL CHARACTER
app.all('/character', function(req, res) {
	sess = req.session;
	if (sess.user && req.body.charname) {
		var query = "SELECT * FROM users_chars WHERE name=?";
		var query_var = [req.body.charname];
		db.Select(query, query_var).then(function(result) {
			var query2 = "SELECT name FROM weapons WHERE img=?";
			var query_var2 = [result[0].weapon];
			sess.character_name = result[0].name;
			sess.character_lvl = result[0].lvl;
			sess.character_hp = result[0].hp;
			sess.character_attack = result[0].attack;
			sess.character_defense = result[0].defense;
			sess.character_speed = result[0].speed;
			sess.character_class = result[0].class;

			db.Select(query2, query_var2).then(function(result){
				sess.character_weapon = result[0].name;
				res.render('character.html', {
					sess: sess
				});
			});
		});
	} else {
		res.redirect('/');
	}
});
//FIN DE LA PANTALLA DEL CHARACTER

//PANTALLA DE CREACION DE PJ
app.all('/newchar', function(req, res) {
	sess = req.session;
	if (sess.user && sess.characters_max < 3) {
		var query = "SELECT c.id, c.name, c.hp, c.attack, c.defense, c.speed " + "FROM chars c " + "LEFT JOIN type_chars tc ON c.type_id=tc.id " + "WHERE tc.name='sample'";

		var query_var = [];
		db.Select(query, query_var).then(function(result) {
			res.render('newcharacter.html', {
				result: result,
				sess: sess
			});
		});
	} else {
		res.redirect('/');
	}
});
//FIN DE LA PANTALLA DEL CHARACTER


//URLS PARA PEDIR DATOS A LA BBDD

//LISTADO DE CHARS DE EJEMPLO PARA LA CREACION

app.post('/loadsamplechars', function(req, res) {
	sess = req.session;

	var query = "SELECT * FROM chars WHERE id=?";
	var query_var = [req.body.search];

	db.Select(query, query_var).then(function(result) {
		if (result[0].name === 'Guerrero') {
			var query2 = "SELECT * FROM weapons WHERE weapon='sword'";
		} else if (result[0].name === 'Arquero') {
			var query2 = "SELECT * FROM weapons WHERE weapon='bow'";
		} else { //Mago
			var query2 = "SELECT * FROM weapons WHERE weapon='staff'";
		}
		var query_var2 = [];
		db.Select(query2, query_var2).then(function(weapons) {
			res.send([result[0],weapons]);
		});
	});
});

//GUARDAMOS EL CHAR SELECCIONADO EN LA BASE DE DATOS PARA EL USUARIO

app.post('/saveselectedchar', function(req, res) {
	sess = req.session;
	var ropa;
	var sonido;
	var cabeza;

	if (req.body.gender === "Hombre") {
		cabeza = "male_head.png";
		if (req.body.class === "Arquero") {
			ropa = "clothes.png";
			sonido = "bow.wav";
		} else if (req.body.class === "Mago") {
			ropa = "leather_armor.png";
			sonido = "spell.wav";
		} else { //Guerrero
			ropa = "steel_armor.png";
			sonido = "sword.wav";
		}
	} else { //Mujer
		cabeza = "female_head2.png";
		// req.body.weapon = req.body.weapon.slice(0, req.body.weapon.length-4) + "2" + req.body.weapon.slice(req.body.weapon.length-4);
		if (req.body.class === "Arquero") {
			ropa = "clothes2.png";
			sonido = "bow.wav";
		} else if (req.body.class === "Mago") {
			ropa = "leather_armor2.png";
			sonido = "spell.wav";
		} else { //Guerrero
			ropa = "steel_armor2.png";
			sonido = "sword.wav";
		}
	}

	var query = "INSERT INTO users_chars (name,lvl,hp,attack,defense,speed,user_id,image,weapon,head,xPos,yPos,direction,width,height,action,class,sound,kills) VALUES (?,1,?,?,?,?,?,?,?,?,7,7,1,128,128,0,?,?,0)";

	var query_var = [req.body.name, req.body.hp, req.body.attack, req.body.defense, req.body.speed, sess.userid, ropa, req.body.weapon, cabeza, req.body.class, sonido];
	db.Select(query, query_var).then(function() {
		sess.characters.push({ name: req.body.name });
		sess.characters_max += 1;
		sess.character_name = req.body.name;
		sess.character_lvl = 1;
		sess.character_hp = req.body.hp;
		sess.character_attack = req.body.attack;
		sess.character_defense = req.body.defense;
		sess.character_speed = req.body.speed;
		sess.character_class = req.body.class;
		sess.character_weapon = req.body.weaponName;
		res.render('character.html', {
			sess: sess
		});
	});
});

// ELIMINAMOS EL PJ SELECCIONADO

app.post('/deleteselectedchar', function(req, res) {
	sess = req.session;

	var query = "DELETE FROM users_chars WHERE user_id=? AND name=?";
	var query_var = [sess.userid, req.body.name];

	db.Select(query, query_var).then(function() {
		removeByAttr(sess.characters, 'name', req.body.name);
		sess.characters_max -= 1;
		res.render('index.html', {
			sess: sess
		});
	});
});

Object.size = function(obj) {
	var size = 0,
		key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

var removeByAttr = function(arr, attr, value) {
	var i = arr.length;
	while (i--) {
		if (arr[i] && arr[i].hasOwnProperty(attr) && (arguments.length > 2 && arr[i][attr] === value)) {

			arr.splice(i, 1);

		}
	}
	return arr;
};

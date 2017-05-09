
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

server.listen(port, function () {
  console.log('Server listening at port %d', port);
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

// app.listen(3000, function() {
// 	console.log('http://127.0.0.1:3000');
// });

var sess;

//INICIO
app.get('/', function(req, res) {
	sess = req.session;
	res.render('index.html', {
			sess: sess 
		});
	delete sess.signup;
});
//FIN INICIO

//USUARIOS
//LOGIN
app.post('/login', function(req, res){
	var user = req.body.username || "";
	var pass = sha256(req.body.password) || "";

	var query_select = "SELECT name, id FROM users WHERE name=? AND password=?";
	var query_select_var = [user,pass];

	var page = req.body.url;
	sess = req.session;
	
	//LOGUEAMOS
	db.Select(query_select, query_select_var).then(function(result){
		//SI SE ENCUENTRA EL USUARIO:
		if(typeof result[0] != 'undefined'){
		//MIRAMOS SUS PJS CREADOS
		var query = "SELECT name FROM users_chars WHERE user_id=?";
		var query_var = [result[0].id];
		db.Select(query, query_var).then(function(result){
			var size = Object.size(result);
			sess.user = user;
			if(size>0){
				sess.characters = result;
				sess.characters_max = size;
			}else{
				sess.characters_max = 0;
			}
			res.redirect(page);
		});
		//SI NO
		}else{ 
			sess.signup = "El Usuario no existe";
			res.redirect(page);
		}

	}).catch((err) => setImmediate(() => { console.log(err); }));

});
//FIN LOGIN
//SIGN UP
app.post('/signup', function(req, res){

	var user = req.body.username || "";
	var pass = sha256(req.body.password) || "";

	var query_select = "SELECT name FROM users WHERE name=?";
	var query_select_var = [user];
	var query_insert = "INSERT INTO users (name, password) VALUES (?,?)";
	var query_insert_var = [user, pass];

	sess = req.session;
	var page = req.body.url;
	db.Select(query_select, query_select_var).then(function(result){
		if(typeof result[0] != 'undefined'){
			sess.signup = "Ya existe un Usuario con ese nombre.";
			res.redirect(page);
		}else{ 
			db.Insert(query_insert, query_insert_var).then(function(){
				sess.signup = "Usuario creado correctamente. Bienvenido!";
				sess.user=user;
				sess.characters_max = 0;
				res.redirect(page);
			});
		}

	}).catch((err) => setImmediate(() => { console.log(err); }));
});
//FIN SIGN UP
//LOGOUT
app.post('/logout', function(req, res){
	sess = req.session;
	delete sess.user;
	delete sess.characters;
	delete sess.characters_max;
	var page = req.body.url;
	res.redirect(page);
});
//FIN LOGOUT
//FIN USUARIOS

//SOCKETIO
app.all('/chat', function(req,res){
	sess = req.session;
	res.render('chat.html', {
			sess: sess 
		});
});

app.all('/game', function(req,res){
  sess = req.session;
  res.render('game.html', {
      sess: sess 
    });
});

// Chatroom
var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
//FIN SOCKETIO

//PANTALLA DEL CHARACTER
app.all('/character', function(req,res){
	sess = req.session;
	var query = "SELECT * FROM users_chars WHERE name=?";
	var query_var = [req.query.character];
	db.Select(query, query_var).then(function(result){
		sess.character_name = result[0].name;
		sess.character_lvl = result[0].lvl;
		sess.character_hp = result[0].hp;
		sess.character_attack = result[0].attack;
		sess.character_defense = result[0].defense;
		sess.character_speed = result[0].speed;
		sess.character_map = result[0].map;
		res.render('character.html', {
			sess: sess 
		});
	});
});
//FIN DE LA PANTALLA DEL CHARACTER

//PANTALLA DE CREACION DE PJ
app.all('/newchar', function(req,res){
	sess = req.session;
	var query = ""
				+ "SELECT c.id, c.name, c.hp, c.attack, c.defense, c.speed "
				+ "FROM chars c "
				+ "LEFT JOIN type_chars tc ON c.type_id=tc.id "
				+ "WHERE tc.name='sample'";
				
	var query_var = [];
	db.Select(query, query_var).then(function(result){

		res.render('newcharacter.html', {
			result: result,
			sess: sess 
		});
	});
});
//FIN DE LA PANTALLA DEL CHARACTER


//URLS PARA PEDIR DATOS A LA BBDD

//LISTADO DE CHARS DE EJEMPLO PARA LA CREACION

app.post('/loadsamplechars', function(req,res){
	sess = req.session;

	var query = "SELECT * FROM chars WHERE id=?";
	var query_var = [req.query.search];

	//DA UNDEFINED MIRAR
	console.log("Entro a la url, query: "+req.query.parameters);

	res.send("respuesta");

	db.Select(query, query_var).then(function(result){
		console.log("Resultado query: "+result[0].name);
		res.send(result);
	});
});


Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
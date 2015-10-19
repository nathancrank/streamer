var express = require( 'express' );
var app = express();
var http = require( 'http' ).Server( app );
var io = require( 'socket.io' )( http );
var fs = require( 'fs' );
var path = require( 'path' );

var spawn = require( 'child_process' ).spawn;
var proc;
var imageFileName = 'image_stream.jpg';
var streamFolder = './stream/';
var photosFolder = '~/Photos/';
var pathToImage = streamFolder + imageFileName;

var resolution = {
	stream: {
		width: 1280,
		height: 960
	},
	still: {
		width: 2592,
		height: 1944
	}
}

var cameraSettings = {
	secret: 0,
	iso: 0,
	sharpness: 0,
	contrast: 0,
	brightness: 50,
	saturation: 0,
	ev: 0,
	shutter: 16
}

console.log( Date.now() )


app.use( '/', express.static( path.join( __dirname, 'stream' ) ) );

app.get( '/', function( req, res ) {
	res.sendFile( __dirname + '/index.html' );
} );



var sockets = {};

io.on( 'connection', function( socket ) {

	sockets[ socket.id ] = socket;
	console.log( "Total clients connected : ", Object.keys( sockets ).length );

	socket.on( 'disconnect', function() {
		delete sockets[ socket.id ];

		// no more sockets, kill the stream
		if ( Object.keys( sockets ).length == 0 ) {
			app.set( 'watchingFile', false );
			if ( proc ) proc.kill();
			fs.unwatchFile( pathToImage );
		}
	} );

	socket.on( 'start-stream', function() {
		startStreaming( io );
	} );

	socket.on( 'get-settings', function() {
		sendSettings();
	} );

	socket.on( 'take-still', function() {
		takeStill();
	} );

	socket.on( 'send-settings', function( settings ) {
		saveSettings( settings );
	} );

} );

http.listen( 3000, function() {
	console.log( 'listening on *:3000' );
} );

startStreaming( io );



function stopStreaming() {
	if ( Object.keys( sockets ).length == 0 ) {
		app.set( 'watchingFile', false );
		if ( proc ) proc.kill();
		fs.unwatchFile( pathToImage );
	}
}

function startStreaming( io ) {
	console.log( 'startStreaming()' );

	if ( app.get( 'watchingFile' ) ) {
		io.sockets.emit( 'liveStream', imageFileName + '?_t=' + ( Math.random() * 100000 ) );
		return;
	}

	startCamera();

	console.log( 'Watching for changes...' );

	app.set( 'watchingFile', true );

	fs.watchFile( pathToImage, {
		persistent: true,
		interval: 0
	}, function( current, previous ) {
		console.log( 'changed' )
		io.sockets.emit( 'liveStream', imageFileName + '?_t=' + ( Math.random() * 100000 ) );
	} )
}



function startCamera() {
	console.log( 'startCamera()' );
	var args = [ "-w", resolution.stream.width, "-h", resolution.stream.height, "-o", pathToImage, "--nopreview", "-t", "0", "-tl", "30" ];
	if ( cameraSettings.iso != 0 ) {
		args.push( '--ISO' );
		args.push( cameraSettings.iso );
	}
	if ( cameraSettings.sharpness != 0 ) {
		args.push( '--sharpness' );
		args.push( cameraSettings.sharpness );
	}
	if ( cameraSettings.contrast != 0 ) {
		args.push( '--contrast' );
		args.push( cameraSettings.contrast );
	}
	if ( cameraSettings.brightness != 50 ) {
		args.push( '--brightness' );
		args.push( cameraSettings.brightness );
	}
	if ( cameraSettings.saturation != 0 ) {
		args.push( '--saturation' );
		args.push( cameraSettings.saturation );
	}
	if ( cameraSettings.ev != 0 ) {
		args.push( '--ev' );
		args.push( cameraSettings.ev );
	}
	if ( cameraSettings.ev != 0 ) {
		args.push( '--shutter' );
		args.push( cameraSettings.shutter * 1000 );
	}
	proc = spawn( 'raspistill', args );
	io.sockets.emit( 'shutterOpen' );
}

function killCamera() {
	console.log( 'killCamera()' );
	spawn( 'kill', [ proc.pid ] );
}

function takeStill() {
	killCamera();

	var saveFile = './stream/image_' + Date.now() + '.jpg';
	var args = [ "-w", resolution.still.width, "-h", resolution.still.height, "-o", saveFile, "--nopreview", "-t", "1000" ];
	spawn( 'raspistill', args );

	var theTimeout = 2500;
	if ( cameraSettings.shutter > 2500 ) {
		theTimeout += cameraSettings.shutter;
	}

	setTimeout( startCamera, theTimeout );
}

function sendSettings() {
	console.log( 'settings', cameraSettings );
	io.sockets.emit( 'sendSettings', cameraSettings );
}

function saveSettings( newSettings ) {
	console.log( 'newSettings', newSettings );
	if ( newSettings.secret <= cameraSettings.secret ) {
		killCamera();
		console.log( 'saving' );
		cameraSettings = newSettings;
		cameraSettings.secret = Date.now();
		sendSettings();
		startCamera();
	}
}
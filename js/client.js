"use strict";

// Clean-up function:
// collect garbage before unloading browser's window
window.onbeforeunload = function (e) {
  hangup();
};

// Data channel information
var sendChannel, receiveChannel, sendChannel2, receiveChannel2;
// var startButton = document.getElementById("startButton");
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");

// HTML5 <video> elements
const video1 = document.querySelector('video#video1');
const video2 = document.querySelector('video#video2');
const video3 = document.querySelector('video#video3');

// Handler associated with 'Send' button
// startButton.disabled = false;
// startButton.onclick = start;
sendButton.onclick = sendData;

// Flags...
var isChannelReady;
var isChannelReady2;
var isInitiator;
var isStarted;

// WebRTC data structures
// Streams
var localStream;
var remoteStream;
var remoteStream2;
// Peer Connection
let pc1Local;
let pc1Remote;
let pc2Local;
let pc2Remote;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

/////////////////////////////////////////////

// Let's get started: prompt user for input (room name)
var room = prompt("Enter room name:");

// Connect to signalling server
var socket = io.connect();

// Send 'Create or join' message to singnalling server
if (room !== "") {
  console.log("Create or join room", room);
  socket.emit("create or join", room);
}

// Set getUserMedia constraints
var constraints = { audio: false, video: true };

// Call getUserMedia()
navigator.mediaDevices
  .getUserMedia(constraints)
  .then(handleUserMedia)
  .catch(handleUserMediaError);
console.log("Getting user media with constraints", constraints);

// From this point on, execution proceeds based on asynchronous events...

/////////////////////////////////////////////

// getUserMedia() handlers...
/////////////////////////////////////////////
function handleUserMedia(stream) {
  video1.srcObject = stream;
  window.localStream = stream;
  console.log("Adding local stream.");
  sendMessage("got user media");
  if (isInitiator) {
    checkAndStart();
  }
}

function handleUserMediaError(error) {
  console.log("navigator.getUserMedia error: ", error);
}
/////////////////////////////////////////////

// Server-mediated message exchanging...
/////////////////////////////////////////////

// 1. Server-->Client...
/////////////////////////////////////////////

// Handle 'created' message coming back from server:
// this peer is the initiator
socket.on("created", function (room) {
  console.log("Created room " + room);
  isInitiator = true;
});

// Handle 'full' message coming back from server:
// this peer arrived too late :-(
socket.on("full", function (room) {
  console.log("Room " + room + " is full");
});

// Handle 'join' message coming back from server:
// another peer is joining the channel
socket.on("join", function (room) {
  console.log("Another peer made a request to join room " + room);
  console.log("This peer is the initiator of room " + room + "!");
  isChannelReady = true;
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on("joined", function (room) {
  console.log("This peer has joined room " + room);
  isChannelReady = true;
});


// Handle 'join' message coming back from server:
// another peer is joining the channel
socket.on("join 2", function (room) {
  console.log("Another peer made a request to join room " + room);
  console.log("This peer is the initiator of room " + room + "!");
  isChannelReady2 = true;
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on("joined 2", function (room) {
  console.log("This peer has joined room " + room);
  isChannelReady2 = true;
});

// Server-sent log message...
socket.on("log", function (array) {
  console.log.apply(console, array);
});

// Receive message from the other peer via the signalling server
socket.on("message", function (message) {
  console.log("Received message:", message);
  if (message === "got user media") {
    checkAndStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      checkAndStart();
    }
    // pc1Local.setRemoteDescription(new RTCSessionDescription(message));
    // doAnswer();
  } else if (message.type === "answer" && isStarted) {
    // pc1Local.setRemoteDescription(new RTCSessionDescription(message));
  } 
  else if (message === "bye" && isStarted) {
    handleRemoteHangup();
  }
});
////////////////////////////////////////////////

// 2. Client-->Server
////////////////////////////////////////////////
// Send message to the other peer via the signalling server
function sendMessage(message) {
  console.log("Sending message: ", message);
  socket.emit("message", message);
}
////////////////////////////////////////////////////

////////////////////////////////////////////////////
// Channel negotiation trigger function
function checkAndStart() {
  console.log("checkAndStart() first time");
  if (!isStarted && typeof localStream != "undefined" && isChannelReady2) {
    console.log("checkAndStart() second time");
    createPeerConnection();

    // window.localStream.getTracks().forEach(track => pc1Local.addTrack(track, window.localStream));
    // console.log('Adding local stream to pc1Local');
    // pc1Local
    //   .createOffer(offerOptions)
    //   .then(gotDescription1Local, onCreateSessionDescriptionError);

    // window.localStream.getTracks().forEach(track => pc2Local.addTrack(track, window.localStream));
    // console.log('Adding local stream to pc2Local');
    // pc2Local.createOffer(offerOptions)
    //   .then(gotDescription2Local, onCreateSessionDescriptionError);

    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }
}

/////////////////////////////////////////////////////////
// Peer Connection management...
function createPeerConnection() {
  const servers = null;

  try {
    pc1Local = new RTCPeerConnection(servers);
    pc1Remote = new RTCPeerConnection(servers);
    pc1Remote.ontrack = gotRemoteStream1;
    pc1Local.onicecandidate = iceCallback1Local;
    pc1Remote.onicecandidate = iceCallback1Remote;
    console.log('pc1: created local and remote peer connection objects');

    pc2Local = new RTCPeerConnection(servers);
    pc2Remote = new RTCPeerConnection(servers);
    pc2Remote.ontrack = gotRemoteStream2;
    pc2Local.onicecandidate = iceCallback2Local;
    pc2Remote.onicecandidate = iceCallback2Remote;
    console.log('pc2: created local and remote peer connection objects');

    window.localStream.getTracks().forEach(track => pc1Local.addTrack(track, window.localStream));
    console.log('Adding local stream to pc1Local');
    pc1Local
      .createOffer(offerOptions)
      .then(gotDescription1Local, onCreateSessionDescriptionError);

    window.localStream.getTracks().forEach(track => pc2Local.addTrack(track, window.localStream));
    console.log('Adding local stream to pc2Local');
    pc2Local.createOffer(offerOptions)
      .then(gotDescription2Local, onCreateSessionDescriptionError);

  } catch (e) {
    console.log("Failed to create local and remote peer connection objects, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }

  if (isInitiator) {
    try {
      // Create a reliable data channel
      sendChannel = pc1Local.createDataChannel("sendDataChannel");
      console.log("Created send data channel");
    } catch (e) {
      alert("Failed to create data channel. ");
      console.log("createDataChannel() failed with exception: " + e.message);
    }
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onmessage = handleMessage;
    sendChannel.onclose = handleSendChannelStateChange;
  } else {
    // Joiner
    pc1Local.ondatachannel = gotReceiveChannel;
  }
}

// Data channel management
function sendData() {
  var data = sendTextarea.value;
  if (isInitiator) {
    sendChannel.send(data);
  }
  else {
    receiveChannel.send(data);
  }
  console.log("Sent data: " + data);
}

// Handlers...
function gotReceiveChannel(event) {
  console.log("Receive Channel Callback");
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  console.log("Received message: " + event.data);
  receiveTextarea.value += event.data + "\n";
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  console.log("Send channel state is: " + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}

function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  console.log("Receive channel state is: " + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}

// ICE candidates management
function iceCallback1Local(event) {
  handleCandidate(event.candidate, pc1Remote, 'pc1: ', 'local');
}

function iceCallback1Remote(event) {
  handleCandidate(event.candidate, pc1Local, 'pc1: ', 'remote');
}

function iceCallback2Local(event) {
  handleCandidate(event.candidate, pc2Remote, 'pc2: ', 'local');
}

function iceCallback2Remote(event) {
  handleCandidate(event.candidate, pc2Local, 'pc2: ', 'remote');
}

function handleCandidate(candidate, dest, prefix, type) {
  dest.addIceCandidate(candidate)
    .then(onAddIceCandidateSuccess, onAddIceCandidateError);
  console.log(`${prefix}New ${type} ICE candidate: ${candidate ? candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess() {
  console.log('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  console.log(`Failed to add ICE candidate: ${error.toString()}`);
}

// Create Offer
function doCall() {
  console.log("Creating Offer...");
  // pc1Local
  //   .createOffer(offerOptions)
  //   .then(gotDescription1Local, onCreateSessionDescriptionError);
  // pc2Local.createOffer(offerOptions)
  //   .then(gotDescription2Local, onCreateSessionDescriptionError);
}

// Signalling error handler
function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

function gotDescription1Local(desc) {
  pc1Local.setLocalDescription(desc);
  console.log("Offer from pc1Local");
  // console.log(`Offer from pc1Local\n${desc.sdp}`);
  pc1Remote.setRemoteDescription(desc);
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc1Remote.createAnswer().then(gotDescription1Remote, onCreateSessionDescriptionError);
}

function gotDescription1Remote(desc) {
  pc1Remote.setLocalDescription(desc);
  console.log("Answer from pc1Remote");
  // console.log(`Answer from pc1Remote\n${desc.sdp}`);
  pc1Local.setRemoteDescription(desc);
}

function gotDescription2Local(desc) {
  pc2Local.setLocalDescription(desc);
  console.log("Offer from pc2Local");
  // console.log(`Offer from pc2Local\n${desc.sdp}`);
  pc2Remote.setRemoteDescription(desc);
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc2Remote.createAnswer().then(gotDescription2Remote, onCreateSessionDescriptionError);
}

function gotDescription2Remote(desc) {
  pc2Remote.setLocalDescription(desc);
  console.log("Answer from pc2Remote");
  // console.log(`Answer from pc2Remote\n${desc.sdp}`);
  pc2Local.setRemoteDescription(desc);
}

// Create Answer
// function doAnswer() {
//   console.log("Sending answer to peer.");
//   pc1Remote.createAnswer().then(gotDescription1Remote, onCreateSessionDescriptionError);
//   pc2Remote.createAnswer().then(gotDescription2Remote, onCreateSessionDescriptionError);
// }

/////////////////////////////////////////////////////////
// Remote stream handlers...

function gotRemoteStream1(e) {
  if (video2.srcObject !== e.streams[0]) {
    video2.srcObject = e.streams[0];
    console.log('pc1: received remote stream');
  }
}

function gotRemoteStream2(e) {
  if (video3.srcObject !== e.streams[0]) {
    video3.srcObject = e.streams[0];
    console.log('pc2: received remote stream');
  }
}

function handleRemoteStreamRemoved(event) {
  console.log("Remote stream removed. Event: ", event);
}
/////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
// Clean-up functions...

function hangup() {
  console.log("Hanging up.");
  stop();
  sendMessage("bye");
}

function handleRemoteHangup() {
  console.log("Session terminated.");
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  if (sendChannel2) sendChannel2.close();
  if (receiveChannel2) receiveChannel2.close();
  pc1Local.close();
  pc1Remote.close();
  pc2Local.close();
  pc2Remote.close();
  pc1Local = pc1Remote = null;
  pc2Local = pc2Remote = null;
  sendButton.disabled = true;
}

///////////////////////////////////////////


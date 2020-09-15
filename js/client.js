"use strict";

// Clean-up function:
// collect garbage before unloading browser's window
window.onbeforeunload = function (e) {
  hangup();
};

// Data channel information
var sendChannel, receiveChannel;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");

// HTML5 <video> elements
var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");

// Handler associated with 'Send' button
sendButton.onclick = sendData;

// Flags...
var isChannelReady;
var isChannelReady2;
var isInitiator;
var isJoiner;
var isStarted;

// WebRTC data structures
// Streams
var localStream;
var remoteStream;
// Peer Connection
var pc, pc2;

/////////////////////////////////////////////

// Let's get started: prompt user for input (room name)
var room = prompt("Enter room name:");

// Connect to signalling server
var socket = io.connect();

// Send 'Create or join' message to signalling server
if (room !== "") {
  console.log("Create or join room", room);
  socket.emit("create or join", room);
}

// Set getUserMedia constraints
var constraints = { audio: false, video: true };

pc = new RTCPeerConnection();
pc2 = new RTCPeerConnection();

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
  localStream = stream;
  // attachMediaStream(localVideo, stream);
  localVideo.srcObject = stream;
  console.log("Adding local stream.");
  sendMessage("got user media");
  if (isInitiator) {
    // checkAndStart();
  }
  pc.addStream(localStream);
  pc2.addStream(localStream);
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
  createPeerConnection();
  isStarted = true;
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
  createPeerConnection();
  isStarted = true;
  isJoiner = true;
  doCall();
});

// Server-sent log message...
socket.on("log", function (array) {
  console.log.apply(console, array);
});

var count = 0;
var cand = 0;
// Receive message from the other peer via the signalling server
socket.on("message", function (message) {
  console.log("Received message:", message);
  if (message === "got user media") {
    // checkAndStart();
  } else if (message.type === "offer") {
    // if (!isInitiator && !isStarted) {
    //   checkAndStart();
    // }
    console.log("isInitiator = " + isInitiator);
    console.log("isJoiner = " + isJoiner);
    if (count == 0) {
      console.log("pc1 called, count = " + count);
      pc2.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer2();
      count += 1;
    } else {
      console.log("pc2 called, count = " + count);
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    }
  } else if (message.type === "answer" && isStarted) {
    console.log("isInitiator = " + isInitiator);
    console.log("isJoiner = " + isJoiner);
    if (count == 0) {
      console.log("pc1 answer called, count = " + count);
      pc.setRemoteDescription(new RTCSessionDescription(message));
      count += 1;
    } else {
      console.log("pc2 answer called, count = " + count);
      pc2.setRemoteDescription(new RTCSessionDescription(message));
    }
  } else if (message.type === "candidate" && isStarted) {
    console.log("isInitiator = " + isInitiator);
    console.log("isJoiner = " + isJoiner);
    console.log("candidate count = " + cand);
    console.log("btw, count = " + count);
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    pc2.addIceCandidate(candidate);
  } else if (message.type === "candidate 2" && isStarted) {
    console.log("isInitiator = " + isInitiator);
    console.log("isJoiner = " + isJoiner);
    console.log("candidate count = " + cand);
    console.log("btw, count = " + count);
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    pc.addIceCandidate(candidate);
  } else if (message === "bye" && isStarted) {
    //handleRemoteHangup();
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
  
  if (!isStarted && typeof localStream != "undefined" && isChannelReady2) {
    
    createPeerConnection();

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
    // pc = new RTCPeerConnection();
    pc.onicecandidate = handleIceCandidate;
  } catch (e) {
    console.log("Failed to create local and remote peer connection objects, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }

  try {
    // pc = new RTCPeerConnection();
    pc2.onicecandidate = handleIceCandidate2;
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
  pc2.onaddstream = handleRemoteStreamAdded;
  pc2.onremovestream = handleRemoteStreamRemoved;

  // if (isInitiator) {
  //   try {
  //     // Create a reliable data channel
  //     sendChannel = pc.createDataChannel("sendDataChannel");
  //     trace("Created send data channel");
  //   } catch (e) {
  //     alert("Failed to create data channel. ");
  //     trace("createDataChannel() failed with exception: " + e.message);
  //   }
  //   sendChannel.onopen = handleSendChannelStateChange;
  //   sendChannel.onmessage = handleMessage;
  //   sendChannel.onclose = handleSendChannelStateChange;
  // } else {
  //   // Joiner
  //   pc.ondatachannel = gotReceiveChannel;
  // }
}

// Data channel management
function sendData() {
  var data = sendTextarea.value;
  if (isInitiator) sendChannel.send(data);
  else receiveChannel.send(data);
  trace("Sent data: " + data);
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

function handleIceCandidate2(event) {
  console.log("handleIceCandidate event: ", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate 2",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates.");
  }
}

// Create Offer
function doCall() {
  console.log("Creating Offer...");
  pc.createOffer(setLocalAndSendMessage, onSignalingError);
  pc2.createOffer(setLocalAndSendMessage2, onSignalingError);
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

function doAnswer2() {
  console.log("Sending answer to peer.");
  pc2.createAnswer(setLocalAndSendMessage2, onSignalingError);
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function setLocalAndSendMessage2(sessionDescription) {
  pc2.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

/////////////////////////////////////////////////////////
// Remote stream handlers...

function gotDescription2Remote(desc) {
  pc2Remote.setLocalDescription(desc);
  console.log("Answer from pc2Remote");
  // console.log(`Answer from pc2Remote\n${desc.sdp}`);
  pc2Local.setRemoteDescription(desc);
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
  if (pc) pc.close();
  pc = null;
  sendButton.disabled = true;
}

///////////////////////////////////////////

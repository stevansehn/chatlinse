"use strict";

// Clean-up function:
// collect garbage before unloading browser's window
// window.onbeforeunload = function (e) {
  // hangup();
// };

// Data channel information
var sendChannel, receiveChannel;
// var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");

// HTML5 <video> elements
var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");
var remoteVideo2 = document.querySelector("#remoteVideo2");

// Handler associated with 'Send' button
// sendButton.onclick = sendData;

// Flags...
var isChannelReady;
var isInitiator;
var isJoiner, isJoiner2;
var isStarted, isStarted2;
var answered, answered2;

// WebRTC data structures
// Streams
var localStream;
var remoteStream;
var remoteStream2;
// Peer Connection
var pc, pc2;

// Debug vars
var offercount = 0;
var anscount = 0;
var cand = 0;
var okcand = 0;

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
var constraints = { video: true };

// pc = new RTCPeerConnection();
// pc2 = new RTCPeerConnection();

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
  // createPeerConnection();
  // isStarted = true;
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
  isJoiner = true;
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on("joined 2", function (room) {
  console.log("This peer has joined room " + room);
  isChannelReady = true;
  isJoiner2 = true;
});

// Server-sent log message...
socket.on("log", function (array) {
  console.log.apply(console, array);
});

// Receive message from the other peer via the signalling server
socket.on("message", function (message) {
  console.log("Received message:", message);
  if (message === "got user media") {

    // console.log("isInitiator = " + isInitiator);
    // console.log("isJoiner = " + isJoiner);
    // console.log("isJoiner2 = " + isJoiner2);

    sendMessage("make the call");

  } else if (message === "make the call") {
    // console.log("isInitiator = " + isInitiator);
    // console.log("isJoiner = " + isJoiner);
    // console.log("isJoiner2 = " + isJoiner2);

    if (isJoiner && !isStarted) {
      createPeerConnection();
      pc.addStream(localStream);
      isStarted = true;
      console.log("making the call...");
      doCall();
    }

    if (isJoiner2 && !isStarted) {
      createPeerConnection();
      pc.addStream(localStream);
      createPeerConnection2();
      pc2.addStream(localStream);
      isStarted = true;
      console.log("making the call...");
      doCall();
      doCall2();
    }
  } else if (message.type === "offer") {
    // console.log("isInitiator = " + isInitiator);
    // console.log("isJoiner = " + isJoiner);
    // console.log("isJoiner2 = " + isJoiner2);
    offercount += 1;
    // console.log("offercount = " + offercount);

    if (isInitiator && !isStarted) {
      console.log("createPeerConnection()");
      createPeerConnection();
      pc.addStream(localStream);
      isStarted = true;
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    }

    if (isJoiner && !isStarted2 && offercount == 1) {
      console.log("createPeerConnection2()");
      createPeerConnection2();
      pc2.addStream(localStream);
      isStarted2 = true;
      pc2.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer2();
    }

    if (isInitiator && !isStarted2 && offercount == 3) {
      console.log("createPeerConnection2()");
      createPeerConnection2();
      pc2.addStream(localStream);
      isStarted2 = true;
      pc2.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer2();
    }

  } else if (message.type === "answer") {
    // console.log("isInitiator = " + isInitiator);
    // console.log("isJoiner = " + isJoiner);
    // console.log("isJoiner2 = " + isJoiner2);

    if (!isJoiner2 && isStarted && !answered) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
      answered = true;
    }
    if (!isJoiner2 && isStarted2 && answered && !answered2) {
      pc2.setRemoteDescription(new RTCSessionDescription(message));
      answered2 = true;
    }
    if (isJoiner2 && isStarted && !answered) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
      answered = true;
    }
    if (isJoiner2 && isStarted2 && answered && !answered2) {
      pc2.setRemoteDescription(new RTCSessionDescription(message));
      answered2 = true;
    }
  } else if (message.type === "candidate") {
    console.log("isInitiator = " + isInitiator);
    console.log("isJoiner = " + isJoiner);
    console.log("isJoiner2 = " + isJoiner2);
    cand += 1;
    console.log("candidate count = " + cand);
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });

    if (isStarted && okcand == 0) {
      okcand += 1;
      console.log("pc.addIceCandidate(candidate)");
      pc.addIceCandidate(candidate);
    }

    if (isJoiner && isStarted2 && okcand == 1) {
      okcand += 1;
      console.log("pc2.addIceCandidate(candidate)");
      pc2.addIceCandidate(candidate);
    }

    if (isJoiner2) {
      console.log("candidate: isJoiner2 isStarted2 = true");
      isStarted2 = true;
    }

    console.log("successful candidates = " + okcand);
  } else if (message.type === "candidate 2") {
    console.log("isInitiator = " + isInitiator);
    console.log("isJoiner = " + isJoiner);
    console.log("isJoiner2 = " + isJoiner2);
    cand += 1;
    console.log("candidate count = " + cand);
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });

    if (isStarted && okcand == 0) {
      okcand += 1;
      console.log("pc.addIceCandidate(candidate)");
      pc.addIceCandidate(candidate);
    }

    if (isInitiator && isStarted2 && okcand == 1) {
      okcand += 1;
      console.log("pc.addIceCandidate(candidate)");
      pc2.addIceCandidate(candidate);
    }

    if (isJoiner2 && okcand == 0) {
      okcand += 1;
      console.log("pc.addIceCandidate(candidate)");
      pc.addIceCandidate(candidate);
    }

    if (isJoiner2 && isStarted2 && okcand == 1) {
      okcand += 1;
      console.log("pc2.addIceCandidate(candidate)");
      pc2.addIceCandidate(candidate);
    }

    if (isJoiner2) {
      console.log("candidate 2: isJoiner2 isStarted2 = true");
      isStarted2 = true;
    }
    console.log("successful candidates = " + okcand);
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

/////////////////////////////////////////////////////////
// Peer Connection management...
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection();
    pc.onicecandidate = handleIceCandidate;
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;

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

function createPeerConnection2() {
  try {
    pc2 = new RTCPeerConnection();
    pc2.onicecandidate = handleIceCandidate2;
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
  pc2.onaddstream = handleRemoteStreamAdded2;
  pc2.onremovestream = handleRemoteStreamRemoved;
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
  trace("Receive Channel Callback");
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  trace("Received message: " + event.data);
  receiveTextarea.value += event.data + "\n";
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace("Send channel state is: " + readyState);
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
  trace("Receive channel state is: " + readyState);
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
function handleIceCandidate(event) {
  console.log("handleIceCandidate event: ", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates.");
  }
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
}

function doCall2() {
  console.log("Creating Offer...");
  pc2.createOffer(setLocalAndSendMessage2, onSignalingError);
}

// Signalling error handler
function onSignalingError(error) {
  console.log("Failed to create signaling message : " + error.name);
}

// Create Answer
function doAnswer() {
  console.log("Sending answer to peer.");
  pc.createAnswer(setLocalAndSendMessage, onSignalingError);
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

function handleRemoteStreamAdded(event) {
  console.log("Remote stream added.");
  // attachMediaStream(remoteVideo, event.stream);
  remoteVideo.srcObject = event.stream;
  remoteStream = event.stream;
}

function handleRemoteStreamAdded2(event) {
  console.log("Remote stream added.");
  // attachMediaStream(remoteVideo, event.stream);
  remoteVideo2.srcObject = event.stream;
  remoteStream2 = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log("Remote stream removed. Event: ", event);
}
/////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
// Clean-up functions...

// function hangup() {
//   console.log("Hanging up.");
//   stop();
//   sendMessage("bye");
// }

// function handleRemoteHangup() {
//   console.log("Session terminated.");
//   stop();
//   isInitiator = false;
// }

// function stop() {
//   isStarted = false;
//   if (sendChannel) sendChannel.close();
//   if (receiveChannel) receiveChannel.close();
//   if (pc) pc.close();
//   pc = null;
//   sendButton.disabled = true;
// }

///////////////////////////////////////////

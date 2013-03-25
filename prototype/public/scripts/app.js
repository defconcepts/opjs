require([
  'modules/transport', 'modules/pc', 'modules/layout', 'backbone'
  ], function(Transport, PC, Layout, Backbone) {
  'use strict';

  var config = {
    socketServer: 'ws://' + window.location.host,
    pcConfig: {
      iceServers: [
        { url: 'stun:stun.l.google.com:19302' },
        { url: 'stun:23.21.150.121' }
      ]
    }
  };
  // TODO: Fetch contacts from remote identitiy provider
  var contacts = [
    { name: 'creationix' },
    { name: 'robin' },
    { name: 'erik' },
    { name: 'lawrence' },
    { name: 'cassie' },
    { name: 'jugglinmike' }
  ];
  var mediaConstraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  };

  function createOfferFailed() {
    console.error('Create Answer failed');
  }

  function createAnswerFailed() {
    console.error('Create Answer failed');
  }

  var pc = new PC();
  var layout = new Layout({
    el: '#app',
    contacts: new Backbone.Collection(contacts)
  });
  layout.render();
  layout.on('connectRequest', function(stream) {
    // TODO: Derive target user from application state
    var targetUser = 'creationix';
    if (!pc.isActive() && transport.state === 'OPEN') {

      pc.init(config.pcConfig);
      pc.addStream(stream);
      pc.createOffer(
        function(sessionDescription) {
          this.setLocalDescription(sessionDescription);
          transport.peerLocationFind(targetUser, {
            session: sessionDescription,
            userName: userName
          });
        },
        createOfferFailed,
        mediaConstraints);
    }
  });
  layout.on('hangup', function() {
    // TODO: implement `Transport#bye` method (or similar)
    // transport.bye();
    pc.destroy();
  });
  pc.on('addstream', function(stream) {
    console.log('Remote stream added');
    layout.playRemoteStream(stream);
  });
  pc.on('removestream', function() {
    console.log('Remove remote stream');
    layout.stopRemoteStream();
  });
  pc.on('ice', function(msg) {
    console.log('Sending ICE candidate:', msg);
    // TODO: implement `Transport#sendIce` method (or similar)
    // transport.sendIce(msg);
  });
  var transport = new Transport({
    invite: function(request) {
      var blob = request && request.username && request.username.blob;
      var remoteSession;
      if (!blob) {
        console.error('No blob found. Ignoring invite.');
        return;
      }
      remoteSession = blob.session;
      if (!remoteSession) {
        console.error('Remote session not specified. Ignoring invite.');
        return;
      }

      // TODO: Prompt user to accept/reject call (instead of blindly accepting)
      // and move following logic into "Accept" handler.
      console.log('Receiving call from ' + blob.userName +
        '. Would you like to answer?');

      if (!pc.isActive()) {
        pc.init(config.pcConfig);
        // TODO: Refactor so transport is not so tightly-coupled to the layout.
        // This should also allow recieving calls without sharing the local
        // stream.
        pc.addStream(layout.localStreamView.getStream());
      }
      console.log('Creating remote session description:', remoteSession);
      pc.setRemoteDescription(remoteSession);
      console.log('Sending answer...');
      pc.createAnswer(function(sessionDescription) {
          this.setLocalDescription(sessionDescription);
        },
        createAnswerFailed, mediaConstraints);
    }
    // TODO: Implement `ice` message (or similar)
    /*ice: function(candidate) {
      if (!pc.isActive()) {
        return;
      }
      console.log('Received ICE candidate:', candidate);
      pc.addIceCandidate(candidate);
    }*/
  });

  // Infer username from 'username' query string parameter (default to
  // 'creationx') and immediately initiate a connection.
  // TODO: First prompt user for name, then initiate a connection.
  var userName = 'creationix';
  window.location.search
    // Remove leading '?'
    .slice(1)
    .split('&')
    .forEach(function(pair) {
      pair = pair.split('=');
      if (pair[0] === 'username') {
        userName = pair[1];
      }
    });
  transport.open(new WebSocket(config.socketServer))
    .then(function() {
      return transport.sessionCreate(userName);
    })
    .then(function() {
      console.log('Logged in!');
      // TODO: Update UI to reflect logged-in state.
    }, console.error.bind(console));

});

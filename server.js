// server.js
// where your node app starts

// init project
var express = require('express');
var Broadcast = require('./broadcast')

var app = express();

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
console.log('ENV =============> ', process.env.UICD_ENV);
var dbFile = (process.env.UICD_ENV === 'staging') ? "/tmp/db.json" : ".data/db.json";
const adapter = new FileSync(dbFile);
const db = low(adapter);

// Set some defaults
// Note: "ibp" is for "Incident Broadcast Pair". Happy to change it to something else. :)
db.defaults({ ibp: [] })
    .write();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
    response.sendFile(__dirname + '/views/index.html');
});

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/broadcasts", function(request, response) {
    if (Object.keys(request.query).length === 0) {
        throw "Request is missing query parameters!"
    }

    var broadcast = new Broadcast();
    broadcast.create(request.query.site, request.query.message)
        .then(function(broadcastId) {
            db.get('ibp')
                .push({ incidentId: request.query.incidentId, broadcastId: broadcastId })
                .write();
        });

    response.sendStatus(200);
});

app.get("/incidents", function(request, response) {
    console.log("In /incidents");
    var StatusPageAPI = require('statuspage-api');

    var statuspage = new StatusPageAPI({
        pageid: process.env.STATUSPAGE_PAGE_ID,
        apikey: process.env.STATUSPAGE_API_KEY,
        debuglevel: "warn" // Set debug levele: debug, info, warn, error
    });

    function isIncidentOpen(status) {
        return (status !== 'resolved');
        // return ((status !== 'resolved') && (status !== 'completed') && (status !== 'postmortem'));
    }

    var printIncidentTitle = function(result) {
        if (result.error != null) {
            console.log("Error: ", result.error);
        }
        var incidents = [];
        if (result.status == "success") {
            for (var i = 0; i < result.data.length; i++) {
                if (isIncidentOpen(result.data[i].status)) {
                    incidents.push({ id: result.data[i].id, name: result.data[i].name, created_at: result.data[i].created_at, updated_at: result.data[i].updated_at });
                }
            }
        }
        response.json(incidents);
    }

    statuspage.get("incidents", printIncidentTitle);
});

app.get("/add", function(request, response) {
    response.sendFile(__dirname + '/views/add.html');
})

app.get("/new_broadcast", function(request, response) {
    // ?broadcast_message=two&site=three.com
    var q = request.query;
    var message = q.message;
    var site = q.site;

    response.send([message, site]);
})

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
    console.log('Your app is listening on port ' + listener.address().port);
});
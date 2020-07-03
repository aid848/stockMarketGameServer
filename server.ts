import * as rest from "restify";
import tradeRoom from "./tradeRoom";
import compile = WebAssembly.compile;
const fs = require("fs");

let server:rest.Server
let port:number = 8080;



async function start(): Promise<tradeRoom> {
    server = rest.createServer({name: "test"});
    let room:tradeRoom = new tradeRoom("test");

    server.listen(port, function () {
        console.log("listening on " + server.url);
    });
    server.on("error", function () {
        console.log("err");
    })
    server.post({path: "/adminop/:name"}, function (req,res,next) {
        // todo authentication check
        // todo modify stock price
        // todo modify money
        // todo resetDB
        // todo backup DB
        try {
            let answer = undefined;
            if(req.params.name === "stop") {
                answer = room.stop();
            }
            res.contentType = "json";
            res.send(200,{code: answer});
            res.end();
            return next();
        } catch (e) {
            console.log(e);
            return null;
        }
    });
    server.post({path: "/accountCreate/:name/:pass/:cname"}, async function (req,res,next) {
        let state:boolean = await room.createAccount(req.params.name, req.params.pass, req.params.cname);
        res.contentType = "json";
        if (state) {
            res.send(201, {accountCreated: "true"})
        } else {
            res.send(409, {accountCreated: "false"})
        }

    });
    // todo
    // get list of companies
    // post queue buy order
    // get report of individual company
    return room;


}

start().then((r) => {
    console.log("done setup, ready to use");
    setInterval(r.executeTrades, 100);
    // while (r.active) {
    //
    // }

});


// // a static route
// server.get('/foo', function(req, res, next) {});
// // a parameterized route
// server.get('/foo/:bar', function(req, res, next) {});
// // a regular expression
// server.get('/example/:file(^\\d+).png', function(req, res, next) {});
// // an options object
// server.get({
//     path: '/foo',
// }, function(req, res, next) {});
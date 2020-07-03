import * as rest from "restify";
import tradeRoom, {trade} from "./tradeRoom";
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
            res.send(200);
            res.end();
            process.exit(0);
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
        res.end();

    });
    server.post({path: "/trade/:amount/:operation/:seller/:buyer"}, async function (req, res, next) {
        try {
            let t:trade = new trade(req.params.amount,req.params.operation, req.params.seller, req.params.buyer, 0 );
            room.enqueueTrade(t); // todo provide response to trader when trade completed
            res.writeHead(201);
        } catch (e) {
            res.writeHead(409);
            // todo send fail res
        }
        res.end();

    });
    server.get({path: "/companies"}, async function (req,res,next) {
        res.contentType = "json";
        let x = await room.getCompanies(room)
        res.send(200,x);
        res.end();


    });
    // todo
    // get report of individual company
    // get completed trades per person
    // post transfer shares
    return room;


}

start().then((r) => {
    console.log("done setup, ready to use");
    setInterval(r.executeTrades, 100, r);
    // while (r.active) {
    //
    // }

});
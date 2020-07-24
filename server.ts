import * as rest from "restify";
import tradeRoom, {trade} from "./tradeRoom";
import * as corsMiddleware from "restify-cors-middleware";
const fs = require("fs");

let server:rest.Server
let port:number = 8080;


// todo setting for self ownership of stock
async function start(): Promise<tradeRoom> {


    const cors = corsMiddleware({
        preflightMaxAge:5,
        origins: ["*"],
        allowHeaders: ["*"],
        exposeHeaders: ["*"],

    });

    server = rest.createServer({name: "test"});
    let room:tradeRoom = new tradeRoom("test");
    server.pre(cors.preflight);
    server.use(cors.actual);
    server.use(rest.plugins.bodyParser());
    server.listen(port, function () {
        console.log("listening on " + server.url);
    });
    server.on("error", function () {
        console.log("err");
    });
    server.post({path: "/login"}, function (req,res,next) {
        console.log(req.body);
        if(req.body !== undefined) {
            if(req.body["username"] !== undefined && req.body["password"] !== undefined) {
                room.loginCheck(req.body["username"], req.body["password"], room).then((answer) => {
                    res.send(202, {name: answer});
                    console.log("accepted")
                    res.end();
                }).catch((err) => {
                    res.send(409);
                    res.end();
                })
            }else {
                res.send(409);
                res.end();
            }
        }else {
            res.send(409);
            res.end();
        }
    });
    server.post({path: "/adminop/:name"}, function (req,res,next) {
        // todo modify stock price
        // todo modify money
        // todo resetDB
        // todo backup/restore DB
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
        // todo change endpoint to json
        let state:boolean = await room.createAccount(req.params.name, req.params.pass, req.params.cname);
        res.contentType = "json";
        if (state) {
            res.send(201, {accountCreated: "true"})
        } else {
            res.send(409, {accountCreated: "false"})
        }
        res.end();

    });
    server.post({path: "/trade"}, async function (req, res, next) {
        try {
            // console.log(req.body);
            let t:trade = new trade(req.body.amount,req.body.operation, req.body.seller, req.body.buyer, 0);
            // let t:trade = new trade(req.params.amount,req.params.operation, req.params.seller, req.params.buyer, 0 );
            // room.enqueueTrade(t); // todo provide response to trader when trade completed
            room.executeTrade(t, room).then((ans:string) => {
                res.send(201, {message:ans});
                console.log("ans = " + ans);
                res.end();
            })
        } catch (e) {
            res.send(409, {message: "trade Failed"});
            res.end();
        }


    });
    server.get({path: "/companies"}, async function (req,res,next) {
        res.contentType = "json";
        let x = await room.getCompanies(room)
        res.send(200,x);
        res.end();
    });
    server.get({path: "/company/:name"}, async function (req, res, next) {
        // todo get money AND get holdings
        let x = await room.getCompanyData(room, req.params.name);
        res.send(200, x);
        res.end();
    })


    // todo
    // authentication
    // get report of individual company
    // settings file
    // admin console
    // get completed trades per person
    // post transfer shares
    return room;


}

async function configure(): Promise<boolean> {
    // todo read from settings file, otherwise set to
    return undefined;
}

start().then((r) => {
    console.log("done setup, ready to use");
    // setInterval(r.executeTrades, 100, r);
    // while (r.active) {
    //
    // }

});

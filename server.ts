import * as rest from "restify";
import tradeRoom, {trade} from "./tradeRoom";
import {rank} from "./Ranks";
import * as corsMiddleware from "restify-cors-middleware";
const fs = require("fs");

let server:rest.Server
let port:number = 8080;


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
        // todo next trade cycle
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
    server.post({path: "/accountCreate"}, async function (req,res,next) {
        // todo write company to like, like/dislike db
        res.contentType = "json";
        let state:boolean = await room.createAccount(req.body.name, req.body.pass, req.body.cname);
        let companyCheck:boolean = await room.checkCompany(room, req.body.cname);
        // todo reinable companyName check
        // state = state && companyCheck;

        if (state === true) {
            setupCompanyDirectory(req.body.cname);
            fillCompanyDirectoryWithData(req.body.cname, req.body.description, req.body.logo, false);
            res.send(201, {accountCreated: "true"})
        } else {
            res.send(409, {accountCreated: "false"})
        }
        res.end();

    });
    server.post({path: "/trade"}, async function (req, res, next) {
        try {
            let t:trade = new trade(req.body.amount,req.body.operation, req.body.seller, req.body.buyer, 0);
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
    server.post({path: "/rank"}, async function (req, res, next) {
        let ranker:string = req.body.ranker;
        let rankee:string = req.body.rankee;
        // todo call rank db
        res.send(400);
        res.end();
    })
    server.post({path: "/writeCompanyInfo/:name"} , async function (req,res,next) {
        fillCompanyDirectoryWithData(req.params.cname, req.params.description, req.params.logo, true);
        res.send(201);
        res.end();
    })
    server.get({path: "/companies"}, async function (req,res,next) {
        res.contentType = "json";
        let x = await room.getCompanies(room)
        res.send(200,x);
        res.end();
    });
    server.get({path: "/company/:name"}, async function (req, res, next) {
        console.log("name is :" + req.params.name)
        return room.getCompanyData(room, req.params.name).then((x)=> {
            res.send(200, x);
            res.end();
        });

    });
    server.get({path: "/companyHoldings/:name"}, async function (req, res, next) {

        return room.getCompanyHoldings(room, req.params.name).then((x)=> {
            res.send(200, x);
            res.end();
        });

    });
    server.get({path: "/notifications"}, async function (req,res,next) {
        // todo get notifications for a user
    });
    server.get({path: "/companyPage/:company"}, function (req,res,next) {
        // todo get company info page
        return new Promise(((resolve, reject) => {
            try {
                let basePath:string = "company_pages/" + req.params.company + "/";
                let logo:string = fs.readFileSync(basePath + "logo.jpg", "base64");
                let description:string = fs.readFileSync(basePath + "description.txt", "ascii");
                let updates: any[] = [];
                let updateNames: string[] = fs.readdirSync(basePath + "/updates");
                for (let x = updateNames.length-1; x>=0; x--) {
                    let entry = fs.readFileSync(basePath + "updates/" + updateNames[x], {encoding: "utf8"});
                    updates.push(entry);
                }
                updates = updates.reverse();
                res.send(200, {companyPhoto: logo, description: description, updates: updates});
                resolve();
            } catch (e) {
                res.send(404, e);
                reject(e);
            }
        })).then(() => {
            res.end();
        }).catch(() => {
            res.end();
        });
    });
    server.get({path: "/nameCheck/:name/:company"}, async function (req,res,next)  {
        let ans: boolean = await room.checkAccount(room, req.params.name);
        let comp: boolean = await room.checkCompany(room, req.params.company);
        ans = ans && comp;
        if(ans === true) {
            res.send(200);
        }else {
            res.send(406);
        }
        res.end();
    })

    return room;


}

// async function configure(): Promise<boolean> {
//     // todo read from settings file, otherwise set to
//     return undefined;
// }

function setupCompanyDirectory(name:string):any {
    let base:string = "company_pages/" + name + "/";
    fs.mkdirSync(base);
    fs.mkdirSync(base + "updates");
}

function decodeBase64Image(dataString) {
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/), response = {
        type: undefined,
        data: undefined
    };
    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');

    return response;
}

// REQUIRES: setupCompanyDirectory be run prior for folders to be set up
function fillCompanyDirectoryWithData(name:string,description:string, logo:string, overwrite: boolean):any {
    let base:string = "company_pages/" + name + "/";
    if(overwrite){
        fs.unlinkSync(base + "description.txt");
        fs.unlinkSync(base + "logo.jpg");
    }
    fs.writeFileSync(base + "description.txt", description, {encoding: "utf8"});
    let cleaned = decodeBase64Image(logo);
    console.log(cleaned);
    fs.writeFileSync(base + "logo.jpg", cleaned.data);

}

type companyData = {
    description:string;
    logo:string;
    updates:string[];
}

start().then((r) => {
    console.log("done setup, ready to use");
    // setInterval(r.executeTrades, 100, r);
    // while (r.active) {
    //
    // }

});

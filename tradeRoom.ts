import {Database, RunResult, Statement} from "sqlite3";
import get = Reflect.get;
const fs = require("fs");



function err(error) {
    if(error !== null)
        console.log("The error was: "+error);
}

export default class tradeRoom {
    private readonly name: string;
    public active: boolean;
    private sql;
    private defaultShares = 10000;
    private defaultPricePerShare = 1.00;
    public tradeQueue:trade[];
    private startingMoney = 1000.0;
    private tradeBias:number = 0.05;


    constructor(name:string) {
        this.name = name;
        this.tradeQueue = new Array<trade>();
        if (!fs.existsSync("db")) {
            fs.mkdirSync("db");
        }
        this.sql = new Database('./db/' + this.name + '.db')
        this.sql.on("error", function (error) {
            console.log("Your error was:" + error);
        })
        //todo move to discrete SQL files

        // account database
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyaccount(' +
            'name TEXT UNIQUE,' +
            'username TEXT PRIMARY KEY,' +
            'password TEXT NOT NULL,' +
            'money REAL);');

        // trading database todo fix/add key constaints
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyindex(' +
            'name TEXT PRIMARY KEY,' +
            'value REAL NOT NULL,' +
            'sharesRemaining INTEGER NOT NULL,' +
            'previous_value REAL NOT NULL' +
            ');');


        // todo holdings database (who owns what shares and how many)
        // todo todo fix/add key constaints
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyholdings(' +
            'holder TEXT NOT NULL,' +
            'held TEXT NOT NULL,' +
            'amount INTEGER NOT NULL );');


        this.active = true;
        console.log("new trading room created: " + name)
    }

    public async createAccount(username, pass,companyname): Promise<boolean> {
        return this.checkAccount(username).then((res) => {
            if (res) {
                // console.log('insert INTO main.companyaccount(name, username, password)' +
                //     ' VALUES (\"' + companyname + '\", \"' + username + "\",\"" + pass +  '\")');
                // todo template statments to sql file
                return this.sql.serialize(() => {
                    this.sql.run('insert INTO main.companyaccount(name, username, password, money)' +
                        ' VALUES (\"' + companyname + '\", \"' + username + "\",\"" + pass +  '\",' + this.startingMoney +  ')', undefined, err);
                    this.sql.run('insert INTO main.companyindex(name,value,sharesRemaining,previous_value)' +
                        ' VALUES (\"' + companyname + "\"," + this.defaultPricePerShare + ',' + this.defaultShares + "," + this.defaultShares + ')', undefined, err);
                    return true;
                });

            } else {
                return false;
            }
        })
    }

    public enqueueTrade(trade:trade):void {
        this.tradeQueue.push(trade);
    }

    public async checkAccount(username):Promise<boolean> {
        return this.sql.all("Select name FROM main.companyaccount WHERE name = \"" + username + "\"", [], (err: any, rows: any) => {
           console.log(err);
           console.log(rows)
            // return true;
            return rows.length > 0;
        });
    }

    public async executeTrades(self: tradeRoom):Promise<void>{
        // console.log("running");
        // console.log(self.tradeQueue);
        if (self.tradeQueue !== undefined) {
            console.log("queued trades: " + self.tradeQueue.length);
            while (self.tradeQueue.length > 0) {
                await self.executeTrade(self.tradeQueue.shift(), self);
            }
        }
        return;
    }
    private async executeTrade(trade: trade, self: tradeRoom): Promise<void> { // incomplete
        if (trade.operation) { // buy
            if(trade.amount <= 0) {
                return;
            }
            self.sql.all("Select DISTINCT money FROM main.companyaccount WHERE name = \"" + trade.buyer + "\"", function (err: any, rows: any) { // check enough money
                // let errors:number = 0;
                let money: number = undefined;
                let cost: number = undefined;
                let shares: number = undefined;
                let value: number = undefined;
                    if (err !== null || rows === null || rows === undefined) {
                        // errors++;
                        return;
                    } else {
                        if (rows.length === 1) {
                            // determine remaining money
                            money = rows[0].money;
                            // console.log(rows);
                        } else {
                            return;;
                            // errors++;
                        }
                    }

                self.sql.all("Select DISTINCT sharesRemaining, value FROM main.companyindex WHERE name = \"" + trade.seller + "\"", function (err: any, rows: any) { // check available shares and price
                    // console.log("e");
                    if (err !== null || rows === null || rows === undefined) {
                        // errors++;
                        return;;
                    } else {
                        if (rows.length === 1) {
                            // determine share number and value
                            value = rows[0].value;
                            shares = rows[0].sharesRemaining;
                            // console.log(rows);
                        } else {
                            return;
                            // errors++
                        }
                    }
                    if (shares === undefined || money === undefined || value === undefined) {
                        console.log("trade failed");
                        console.log(shares);
                        console.log(money);
                        console.log(value);
                        return;
                    }
                    cost = trade.amount * value;
                    if (cost <= money && shares>= trade.amount) {
                        console.log("trade accepted");
                        // todo update seller and buyer tables
                        self.sql.serialize(() => {
                            // buyer remove money and put owned shares on record
                            self.sql.run("UPDATE main.companyaccount set money = " + (money - cost) + " WHERE name = \"" + trade.buyer + "\"");
                            // todo check if existing holdings
                            self.sql.run("INSERT INTO main.companyholdings(holder, held, amount) VALUES(\"" + trade.buyer + "\", \"" + trade.seller + "\" , " + trade.amount +");");
                            // todo seller change available shares and share price (up or down depending on op)
                            // tradeBias
                            self.sql.run("UPDATE main.companyindex set sharesremaining = " + (shares-trade.amount) + " where name = \"" + trade.seller + "\"")
                            self.sql.run("UPDATE main.companyindex set previous_value = " + value + " where name = \"" + trade.seller + "\"")
                            self.sql.run("UPDATE main.companyindex set value = " + (value + value*self.tradeBias) + " where name = \"" + trade.seller + "\"")
                        });
                    } else {
                        console.log("trade unsuccessful" + cost + " and " + money);
                    }
                    return;
                });
                });

        } else { // sell
            // todo verify: has that many shares of that company
            // todo restore available shares to other company
        }
        return;
    }

    public transferShares(){
        // todo
    }


    public restart(): boolean{
        // todo move code from constructor to here
        console.log("starting");
        this.sql = new Database('./db/' + this.name + '.db');
        return true;
    }

    public stop(): void {
        // todo halt accepting trades and complete before shutdown
        console.log("stopping");
        this.sql.close();
        this.active = false
        return;
    }



}


export class trade{

    private readonly _amount:number;
    private readonly _operation:boolean; // buy = 1, sell = 0
    private readonly _seller:string;
    private readonly _buyer:string;
    private _status:number;

    constructor(amount: number, operation: boolean, seller: string, buyer: string, status:number) {
        this._amount = amount;
        this._operation = operation;
        this._seller = seller;
        this._buyer = buyer;
        this._status = status;
    }

    get amount(): number {
        return this._amount;
    }

    get operation(): boolean {
        return this._operation;
    }

    get seller(): string {
        return this._seller;
    }

    get buyer(): string {
        return this._buyer;
    }

    get status(): number {
        return this._status;
    }

    set status(value: number) {
        this._status = value;
    }
}
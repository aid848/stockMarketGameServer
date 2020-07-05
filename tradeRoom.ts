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
    private defaultPricePerShare = 5.00;
    public tradeQueue:trade[];
    private startingMoney = 1000.0;
    private tradeBias:number = 0.0005;


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
        // todo trades database (completed and rejected)

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
            'previous_value REAL NOT NULL' + // todo this needs to be computed in a better way
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
                        ' VALUES (\"' + companyname + "\"," + this.defaultPricePerShare + ',' + this.defaultShares + "," + this.defaultPricePerShare + ')', undefined, err);
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

    public async loginCheck(username:string, password:string, self:tradeRoom):Promise<String> {
        // todo change to return access token
        return new Promise<any> ((resolve, reject) => {self.sql.all("SELECT * FROM main.companyaccount WHERE username = \"" + username + "\" AND password = \"" + password + "\"", function (err:any, rows:any) {
            console.log(rows);
            if(err!=undefined) {
                reject("");
            }else {
                if(rows.length !== 1 ) {
                    reject("");
                }else {
                    resolve(rows[0].name);
                }

            }
        } )});
    }

    public async executeTrades(self: tradeRoom):Promise<void>{
        if (self.tradeQueue !== undefined) {
            // console.log("queued trades: " + self.tradeQueue.length);
            while (self.tradeQueue.length > 0) {
                await self.executeTrade(self.tradeQueue.shift(), self);
            }
        }
        return;
    }
    private async executeTrade(trade: trade, self: tradeRoom): Promise<void> { // todo convert to sending promise value to request
        if (trade.operation == 1) { // buy
            if(trade.amount <= 0) {
                return;
            }
            self.sql.all("Select DISTINCT money FROM main.companyaccount WHERE name = \"" + trade.buyer + "\"", function (err: any, rows: any) { // check enough money
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
                            self.sql.all("SELECT * FROM main.companyholdings WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"", function (err:any, rows:any) {
                                if(rows.length === 0) {
                                    self.sql.run("INSERT INTO main.companyholdings(holder, held, amount) VALUES(\"" + trade.buyer + "\", \"" + trade.seller + "\" , " + trade.amount +");");
                                }else { // update holdings
                                    self.sql.run("UPDATE main.companyholdings set amount = " + (parseInt(rows[0].amount) + parseInt(String(trade.amount))) + " WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"");
                                }
                            })
                            self.sql.run("UPDATE main.companyindex set sharesremaining = " + (shares-trade.amount) + " where name = \"" + trade.seller + "\"")
                            self.sql.run("UPDATE main.companyindex set previous_value = " + value + " where name = \"" + trade.seller + "\"")
                            let newvalue:number = (value + value*self.tradeBias*trade.amount);
                            if (newvalue <= 0) {
                                newvalue = self.tradeBias*trade.amount;
                            }
                            self.sql.run("UPDATE main.companyindex set value = " + newvalue + " where name = \"" + trade.seller + "\"")
                        });
                    } else {
                        console.log("trade unsuccessful" + cost + " and " + money);
                    }
                    return;
                });
                });

        } else { // sell
            self.sql.all("SELECT * FROM main.companyholdings WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"",function (err:any, rows: any) {
                if (rows.length === 1) {
                    let amount:number = rows[0].amount;
                    if(amount < trade.amount) { // check enough shares to sell
                        console.log("insufficient shares");
                        return;
                    }
                    self.sql.all("SELECT * FROM main.companyindex WHERE name = \"" + trade.seller + "\"", function (err, rows) {
                        if (rows.length === 1){
                            let value: number = rows[0].value;
                            let remaining:number = rows[0].sharesRemaining;
                            self.sql.all("SELECT * FROM main.companyaccount WHERE name = \"" + trade.buyer + "\"" , function (err,rows) {
                                if (rows.length === 1) {
                                    let money:number = rows[0].money;
                                    self.sql.serialize(() => {
                                        // update remaining shares
                                        self.sql.run("UPDATE main.companyholdings set amount = " + (amount - trade.amount) + " WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"");
                                        // add shares back to available
                                        let sremaining:number = (remaining + parseInt(String(trade.amount))) as number
                                        self.sql.run("UPDATE main.companyindex set sharesRemaining = " + sremaining + " WHERE name = \"" + trade.seller + "\"");
                                        // todo drop share value
                                        let newval:number = (value - (value * self.tradeBias * trade.amount));
                                        if (newval < 0) {
                                            newval = 0;
                                        }
                                        self.sql.run("UPDATE main.companyindex set value = " + newval + " WHERE name = \"" + trade.seller + "\"");
                                        // todo add money
                                        self.sql.run("UPDATE main.companyaccount set money = " + (money + value*trade.amount) + " WHERE name = \"" + trade.buyer + "\"");

                                    })
                                }
                            })
                    }
                    })


                }else {
                    console.log("no record of ownership");
                }
                return;
            })

        }
        return;
    }

    public transferShares(){
        // todo
    }

    public async getCompanies(self: tradeRoom):Promise<any> {
            return this.checkCompanies(self).then((res)=> {
                return res;
            });

    }

    private async checkCompanies(self: tradeRoom){

        return new Promise((resolve, reject) => {
            self.sql.all("SELECT DISTINCT * FROM main.companyindex ORDER BY value ASC", (err:any, rows:any) => {
                // console.log(err);
                if(err !== null) {
                    reject(err);
                }
                resolve(rows);
            });
        })
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
    private readonly _operation:number; // buy = 1, sell = 0
    private readonly _seller:string;
    private readonly _buyer:string;
    private _status:number;

    constructor(amount: number, operation: number, seller: string, buyer: string, status:number) {
        this._amount = amount;
        this._operation = operation;
        this._seller = seller;
        this._buyer = buyer;
        this._status = status;
    }

    get amount(): number {
        return this._amount;
    }

    get operation(): number {
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

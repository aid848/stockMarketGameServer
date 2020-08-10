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
    private defaultShares = 1000;
    private defaultPricePerShare = 5.00;
    public tradeQueue:trade[];
    private startingMoney = 1000.0;


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
        // todo generate notification events

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
    public async executeTrade(trade: trade, self: tradeRoom): Promise<String> { // todo convert to sending promise value to request
        if(trade.amount === null) {
            return "amount invalid";
        }
        if (trade.operation == 1) { // buy
            console.log("getting: " + trade.amount);
            if(trade.amount < 0) {
                return "Negative Amount is Invalid";
            }else if(trade.amount === 0){
                return "Please Enter positive number of shares"
            }else if(trade.amount%1 != 0) {
                return "must be whole number of shares"
            }
            return new Promise<string>((resolve, reject) => {
                self.sql.all("Select DISTINCT money FROM main.companyaccount WHERE name = \"" + trade.buyer + "\"", function (err: any, rows: any) { // check enough money
                    let money: number = undefined;
                    let cost: number = undefined;
                    let shares: number = undefined;
                    let value: number = undefined;
                    if (err !== null || rows === null || rows === undefined) {
                        // errors++;
                        resolve("Database Error 1");
                        return;
                    } else {
                        if (rows.length === 1) {
                            // determine remaining money
                            money = rows[0].money;
                            // console.log(rows);
                        } else {
                            resolve("Database Error 2");
                            return;
                            // errors++;
                        }
                    }

                    self.sql.all("Select DISTINCT sharesRemaining, value FROM main.companyindex WHERE name = \"" + trade.seller + "\"", function (err: any, rows: any) { // check available shares and price
                        // console.log("e");
                        if (err !== null || rows === null || rows === undefined) {
                            // errors++;
                            resolve("Database Error 3");
                            return;
                        } else {
                            if (rows.length === 1) {
                                // determine share number and value
                                value = rows[0].value;
                                shares = rows[0].sharesRemaining;
                                // console.log(rows);
                            } else {
                                resolve("Please Select a Company");
                                return;
                                // errors++
                            }
                        }
                        if (shares === undefined || money === undefined || value === undefined) {
                            console.log("trade failed");
                            console.log(shares);
                            console.log(money);
                            console.log(value);
                            resolve("Could not find values in database");
                            return;
                        }
                        cost = trade.amount * value;
                        if (cost <= money && shares>= trade.amount) {
                            console.log("trade accepted");
                            self.sql.serialize(() => {
                                // buyer remove money and put owned shares on record
                                self.sql.run("UPDATE main.companyaccount set money = " + (money - cost) + " WHERE name = \"" + trade.buyer + "\"");
                                // check if existing holdings
                                self.sql.all("SELECT * FROM main.companyholdings WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"", function (err:any, rows:any) {
                                    if(rows.length === 0) {
                                        self.sql.run("INSERT INTO main.companyholdings(holder, held, amount) VALUES(\"" + trade.buyer + "\", \"" + trade.seller + "\" , " + trade.amount +");");
                                    }else { // update holdings
                                        self.sql.run("UPDATE main.companyholdings set amount = " + (parseInt(rows[0].amount) + parseInt(String(trade.amount))) + " WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"");
                                    }
                                })
                                self.sql.run("UPDATE main.companyindex set sharesremaining = " + (shares-trade.amount) + " where name = \"" + trade.seller + "\"")
                                self.sql.run("UPDATE main.companyindex set previous_value = " + value + " where name = \"" + trade.seller + "\"")
                                // let newvalue:number = (value + value*self.tradeBias*trade.amount);
                                // if (newvalue <= 0) {
                                //     newvalue = self.tradeBias*trade.amount;
                                // }
                                // self.sql.run("UPDATE main.companyindex set value = " + newvalue + " where name = \"" + trade.seller + "\"")
                            });
                        } else {
                            console.log("trade unsuccessful" + cost + " and " + money);
                            resolve("Trade Unsuccessful Cost too high. Cost: $" + cost.toFixed(2) + " you only have $" + money.toFixed(2));
                            return;
                        }
                        resolve("Buy order accepted"); // todo better message
                    });
                });
            });

        } else { // sell
            return new Promise<string>((resolve, reject) => {
                    self.sql.all("SELECT * FROM main.companyholdings WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"", function (err: any, rows: any) {
                        if (err !== null || rows === null || rows === undefined) {
                            // errors++;
                            resolve("Database Error 5");
                            return;
                        }
                        if (rows.length === 1) {
                            let amount: number = rows[0].amount;
                            if (amount < trade.amount) { // check enough shares to sell
                                console.log("insufficient shares");
                                resolve("Insufficient shares");
                                return;
                            }
                            self.sql.all("SELECT * FROM main.companyindex WHERE name = \"" + trade.seller + "\"", function (err, rows) {
                                if (err !== null || rows === null || rows === undefined) {
                                    // errors++;
                                    resolve("Database Error 6");
                                    return;
                                }
                                if (rows.length === 1) {
                                    let value: number = rows[0].value;
                                    let remaining: number = rows[0].sharesRemaining;
                                    self.sql.all("SELECT * FROM main.companyaccount WHERE name = \"" + trade.buyer + "\"", function (err, rows) {
                                        if (err !== null || rows === null || rows === undefined) {
                                            // errors++;
                                            resolve("Database Error 7");
                                            return;
                                        }
                                        if (rows.length === 1) {
                                            let money: number = rows[0].money;
                                            self.sql.serialize(() => {
                                                // update remaining shares
                                                self.sql.run("UPDATE main.companyholdings set amount = " + (amount - trade.amount) + " WHERE holder = \"" + trade.buyer + "\" AND held = \"" + trade.seller + "\"");
                                                // add shares back to available
                                                let sremaining: number = (remaining + parseInt(String(trade.amount))) as number
                                                self.sql.run("UPDATE main.companyindex set sharesRemaining = " + sremaining + " WHERE name = \"" + trade.seller + "\"");
                                                // let newval: number = (value - (value * self.tradeBias * trade.amount));
                                                // if (newval < 0) {
                                                //     newval = 0;
                                                // }
                                                // drop share value
                                                // self.sql.run("UPDATE main.companyindex set value = " + newval + " WHERE name = \"" + trade.seller + "\"");
                                                // add money
                                                self.sql.run("UPDATE main.companyaccount set money = " + (money + value * trade.amount) + " WHERE name = \"" + trade.buyer + "\"");

                                            })
                                        }
                                    })
                                }
                            })

                            resolve("Sell Success");
                        } else {
                            console.log("no record of ownership");
                            resolve("no record of ownership");
                            return;
                        }
                    })
            });


        }
    }

    public transferShares(){
        // todo
    }

    public async getCompanies(self: tradeRoom):Promise<any> {
            return this.checkCompanies(self).then((res)=> {
                return res;
            });

    }

    public async getCompanyData(self: tradeRoom, name:string):Promise<any> {
        // todo refactor to avoid triple join, move money query to separate method and query
        return new Promise(((resolve, reject) => {
            self.sql.all("SELECT DISTINCT companyaccount.name,money,holder,held,amount, value\n" +
                "FROM companyaccount JOIN companyholdings ON companyaccount.name = companyholdings.holder\n" +
                "JOIN companyindex ON companyholdings.held = companyindex.name\n" +
                "WHERE holder = \""+ name +"\" ORDER BY value ASC;", (err:any, rows:any) => {
                console.log(rows);
                resolve(rows);
            })
        }));
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

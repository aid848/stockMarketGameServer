import {Database, RunResult, Statement} from "sqlite3";

function hashCode(s) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}

export default class tradeRoom {
    private readonly name: string;
    public active: boolean;
    private sql;
    private defaultShares = 10000;
    private defaultPricePerShare = 1.00;
    private tradeQueue:trade[] = []



    constructor(name:string) {
        this.name = name;
        this.tradeQueue = [];
        this.sql = new Database('./db/' + this.name + '.db')
        //todo move to discrete SQL files

        // account database
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyaccount(' +
            'name TEXT NOT NULL,' +
            'company_ID INTEGER PRIMARY KEY,' +
            'username TEXT UNIQUE,' +
            'password TEXT NOT NULL' +
            ');');

        // trading database todo fix/add key constaints
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyindex(' +
            'name TEXT NOT NULL,' +
            'value REAL NOT NULL,' +
            'sharesRemaining INTEGER NOT NULL,' +
            'previous_value REAL NOT NULL,' +
            'company_ID INTEGER PRIMARY KEY);');


        // todo holdings database (who owns what shares and how many)
        // todo todo fix/add key constaints
        this.sql.run('CREATE TABLE IF NOT EXISTS main.companyholdings(' +
            'company_ID_HOLDER INTEGER PRIMARY KEY,' +
            'company_ID_HELD INTEGER NOT NULL,' +
            'amount INTEGER NOT NULL');


        this.active = true;
        console.log("new trading room created: " + name)
    }

    public async createAccount(username, pass,companyname): Promise<boolean> {
        return this.checkAccount(username).then((res) => {
            if (res) {
                // todo initalize trading and holdings DBs
                this.sql.run('insert INTO main.companyaccount(name,company_ID, username, password)' +
                    ' VALUES (\"' + companyname + "\"," + hashCode(username) + ',\"' + username + "\",\"" + pass +  '\")');
                return true;
            } else {
                return false;
            }
        })
    }

    public async checkAccount(username):Promise<boolean> {
        return this.sql.all("Select name FROM main.companyaccount WHERE name = \"" + username + "\"", [], (err: any, rows: any) => {
           console.log(err);
           console.log(rows)
            // return true;
            return rows.length > 0;
        });
    }

    public async executeTrades():Promise<void>{
        if (this.tradeQueue !== undefined) {
            while (this.tradeQueue.length > 0) {
                await this.executeTrade(this.tradeQueue.shift())
            }
        }
        return;
    }
    private executeTrade(trade:trade): void {
        if(trade.operation) { // buy
            // todo verify: enough money, enough shares to sell,
            return this.sql.all("Select DISTINCT ", function (err: any, rows: any) { // todo querry holdings
                // todo read rows here
            }).then((res:number) => {
                return this.sql.all("Select DISTINCT sharesRemaining FROM main.companyindex WHERE company_ID = " + trade.seller, function (err: any, rows: any) {
                    // rows[0]
                    // todo read rows here
                }).then((res1) => {
                    if (res + res1 === 2) {
                        console.log("trade accepted");
                        // todo update seller and buyer tables
                        return this.sql.run("UPDATE").then(() => {
                            return this.sql.run("UPDATE");
                        });
                    } else {
                        console.log("trade unsuccessful");
                        return 0;
                    }
                })
            })
        }else { // sell
            // todo verify: has that many shares
        }
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

    public stop(): boolean {
        console.log("stopping");
        this.sql.close();
        this.active = false
        return true;
    }



}


export class trade{

    private readonly _amount:number;
    private readonly _operation:boolean; // buy = 1, sell = 0
    private readonly _seller:number;
    private readonly _buyer:number;
    private _status:number;

    constructor(amount: number, operation: boolean, seller: number, buyer: number, status:number) {
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

    get seller(): number {
        return this._seller;
    }

    get buyer(): number {
        return this._buyer;
    }

    get status(): number {
        return this._status;
    }

    set status(value: number) {
        this._status = value;
    }
}
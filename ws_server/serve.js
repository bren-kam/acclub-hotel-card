require('dotenv').load();

const config = require('./config'),
	ApiInterface = require('./apiInterface');

// Modals
const DbInterface = require('./modals/dbInterface');

//require('ssl-root-cas').inject(); @TODO: When we get ready for production.

const server = require('http').createServer(),
	io = require('socket.io')(server);

class HotelCardSocketServer {

	constructor() {
		// PLEASE PAY ATTENTION TO THIS VALUE IN CONSOLE LOGS
		// THIS WILL AVOID UNWARANTED GOOSE CHASING.

		this.SOFTWARE_VERSION = '0.1.1';

		// Server Session Data.
		this.appSession = {
			uid: '',
			sessionToken: ''
		}

		this.port = config.SERVER_PORT;

		this.dbconnection = new DbInterface();
	}

	run() {
		console.log(`Starting server ver ${this.SOFTWARE_VERSION}`);

		this.setupWebsocket();
	}

	setupWebsocket() {
		io.on('connection', (client) => this.socketioOnConnection(client, this.dbconnection));

		server.listen(this.port);
		console.log(`Server running! ${this.port}`);
	}

	socketioOnConnection(client, dbconn) {
		// process.stdout.write('\x1Bc');
		// or
		// console.log('\x1Bc');

		console.log("connect");

		//For Tracking When User Disconnects:
		io.sockets.on("disconnect",function(socket){
			//var socket is the socket for the client who has disconnected.
			console.log("disconnected");
		});

		client.on("issue_card", function(data){
			var sql = "select cards from hotel_room where product_id='" + 
			data['product_id'][0] + "'";

			dbconn.sqlQuery(sql, (res)=>{
				if (res.length !=0) {
					data['prev_cardno'] = res[0]["cards"]
					io.sockets.emit("issue_card", data);
				}
			});
		});

		client.on("delete_card", function(data){
			io.sockets.emit("delete_card", data);
		});

		client.on("write_cardno", function(data){
			data = JSON.parse(data);
			var sql = "update hotel_room set cards = '" +
				data['cardno'] + "' where product_id = '" +
				data['product_no'] + "'";

			dbconn.sqlQuery(sql, (res)=>{
			});
		});

		client.on("get_url", function(data){
			var result_data = {};
			data = JSON.parse(data);
			var sql = "select order_id, folio_id from hotel_room \
				join folio_room_line \
				on hotel_room.id = folio_room_line.room_id \
				join hotel_folio on folio_room_line.folio_id = hotel_folio.id \
				join sale_order on hotel_folio.order_id = sale_order.id \
				where hotel_room.cards = '" +
				data["cardno"] + "' and sale_order.state = 'sale';"

			dbconn.sqlQuery(sql, (res)=>{
				if (res.length !=0) {
					result_data["order_id"] = res[0]["order_id"]
					result_data["folio_id"] = res[0]["folio_id"]
					if (data["pos"] == "true"){
						sql = "select partner_id, res_partner.name as name from sale_order join res_partner \
							on sale_order.partner_id = res_partner.id \
							where sale_order.id='" +
							result_data["order_id"] + "';"
						dbconn.sqlQuery(sql, (res)=>{
							if (res.length != 0){
								result_data["partner_id"] = res[0]["partner_id"];
								result_data["name"] = res[0]["name"];

								io.sockets.emit("pos_customer", result_data);
							}
							
							if (data["hotel"] == "true"){
								io.sockets.emit("get_url", result_data);
							}
						});
					} else {
						if (data["hotel"] == "true"){
							io.sockets.emit("get_url", result_data);
						}
					}
				} else {
					sql = "select hotel_folio.order_id, hotel_folio.id as folio_id from hotel_room \
						join hotel_reservation_line_room_rel \
						on hotel_room.id = hotel_reservation_line_room_rel.room_id \
						join hotel_reservation_line \
						on hotel_reservation_line_room_rel.hotel_reservation_line_id = hotel_reservation_line.id \
						join hotel_reservation \
						on hotel_reservation.id = hotel_reservation_line.line_id \
						join hotel_folio_reservation_rel \
						on hotel_folio_reservation_rel.order_id = hotel_reservation.id \
						join hotel_folio \
						on hotel_folio.id = hotel_folio_reservation_rel.invoice_id \
						where hotel_room.cards = '" +
						data["cardno"] + "';";

					dbconn.sqlQuery(sql, (res)=>{
						result_data["order_id"] = res[0]["order_id"]
						result_data["folio_id"] = res[0]["folio_id"]
						if (data["pos"] == "true"){
							sql = "select partner_id, res_partner.name as name from sale_order join res_partner \
								on sale_order.partner_id = res_partner.id \
								where sale_order.id='" +
								result_data["order_id"] + "';"
							dbconn.sqlQuery(sql, (res)=>{
								if (res.length != 0){
									result_data["partner_id"] = res[0]["partner_id"];
									result_data["name"] = res[0]["name"];

									io.sockets.emit("pos_customer", result_data);
								}

								if (data["hotel"] == "true"){
									io.sockets.emit("get_url", result_data);
								}
							});
						} else {
							if (data["hotel"] == "true"){
								io.sockets.emit("get_url", result_data);
							}
						}
					});
				}
			});
		});
	}
}

const hotelSocketServer = new HotelCardSocketServer();

hotelSocketServer.run();
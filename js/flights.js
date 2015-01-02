var flights;
var carriers = {};
var markets = {};

$(document).ready(main);
    
function main() {
    // Overrides the default autocomplete filter function to search only from the beginning of the string
    // http://stackoverflow.com/a/19053987
    $.ui.autocomplete.filter = function (array, term) {
	var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
	return $.grep(array, function (value) {
            return matcher.test(value.label || value.value || value);
	});
    };

    // load csv files
    load_carriers();
    load_markets();
    load_flights();
}

// load counts of number of flights by (orig, dest, carrier)
// when loaded, allow input in orig/dest boxes
function load_flights() {
    $('#orig, #dest').prop('disabled', true);
    d3.csv("data/dep_arr_by_carrier.csv", function(data) {
	flights = data;
	$('#orig, #dest').prop('disabled', false);
    });
}

// load carriers to convert codes to airline names
function load_carriers() {
    d3.csv("data/carriers.csv", function(data) {
	$.each(data, function(i, carrier) {
	    carriers[carrier.Code] = carrier.Description.replace(/ \(.*\)$/, '');
	});
    });
}

// load mapping from markets to market ids
// only used to get a unique list of market strings for autocomplete right now
// when loaded, enable autocomplete
// on changed value, run plot_num_flights function
function load_markets() {
    d3.csv("data/markets.csv", function(data) {
	$.each(data, function(i, market) {
	    markets[market.Description] = market.Code;
	});
	$('#orig, #dest').autocomplete({source: d3.keys(markets),
					change: plot_num_flights});
    });
}

// plot the number of flights from an origin market to an optional destination market
function plot_num_flights() {
    // grab markets from input boxes
    var orig_market = $('#orig').val();
    var dest_market = $('#dest').val();

    // make sure origin is valid
    // destination is optional, check if given
    if (d3.keys(markets).indexOf(orig_market) < 0 || (dest_market.length > 0 && d3.keys(markets).indexOf(dest_market) < 0))
	return;

    // limit flights for orig(/dest)
    // if no destination given, add all outgoing flights by carrier
    // divide num_flights by 60 hack b/c we have 2 months of data
    var plot_data = {};
    $.each(flights, function(i, flight) {
	if (flight.origin_market == orig_market && (!dest_market || flight.dest_market == dest_market)) {
	    carrier = carriers[flight.carrier];

	    if (carrier in plot_data)
		plot_data[carrier] += flight.num_flights / 60.0;
	    else
		plot_data[carrier] = flight.num_flights / 60.0;
	}
    });

    // convert this dictionary into an array of (key, value) pairs
    // sort by number of flights (value), descending
    plot_data = d3.entries(plot_data);
    plot_data.sort(function(a, b) {
	return b.value - a.value;
    });

    // set up svg canvas and x/y scales, axes
    var margin = {top: 20, right: 20, bottom: 150, left: 40};
    var width = 600 - margin.left - margin.right;
    var height = 400 - margin.top - margin.bottom;

    var x = d3.scale.ordinal()
	.rangeRoundBands([0, width], .1);

    var y = d3.scale.linear()
	.range([height, 0]);

    var xAxis = d3.svg.axis()
	.scale(x)
	.orient("bottom");

    var yAxis = d3.svg.axis()
	.scale(y)
	.orient("left")
	.ticks(10, "%");

    // clear existing plot
    $('#plot').html('');

    // add svg element
    var svg = d3.select("#plot").append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // determine domain for x and y axes
    x.domain(plot_data.map(function(d) { return d.key; }));
    y.domain([0, d3.max(plot_data, function(d) { return d.value; })]);

    // add x-axis labels
    svg.append("g")
	.attr("class", "x axis")
	.attr("transform", "translate(0," + height + ")")
	.call(xAxis)
	.selectAll("text")  
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", function(d) {
                return "rotate(-45)"
        });

    // add y-axis labels
    svg.append("g")
	.attr("class", "y axis")
	.call(yAxis)
	.append("text")
	.attr("transform", "rotate(-90)")
	.attr("y", 6)
	.attr("dy", ".71em")
	.style("text-anchor", "end")
	.text("Number of Flights");

    // add bars
    svg.selectAll(".bar")
	.data(plot_data)
	.enter().append("rect")
	.attr("class", "bar")
	.attr("x", function(d) { return x(d.key); })
	.attr("width", x.rangeBand())
	.attr("y", function(d) { return y(d.value); })
	.attr("height", function(d) { return height - y(d.value); });
}
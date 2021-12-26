
/* <div class="loader"></div>
	ToDo: 
	-don't use a drop-down if possible; maybe check boxes for data to include, e.g. cases, hosp, deaths, vaccinations
	-check box to show: raw values, per 100k, year-to-year pct change
	-be able to show prior year data ahead of current date: start date, time period
	-find max dates for nyt, hhs series and note
	-loading icon
	
	-vaccination: https://data.cdc.gov/api/views/unsk-b7fc/rows.csv?accessType=DOWNLOAD, Series_Complete_65Plus
	
	-Credits:
	Tooltips: https://bl.ocks.org/dianaow/0da76b59a7dffe24abcfa55d5b9e163e
	Case, death data: NY Times, https://github.com/nytimes/covid-19-data
	Hospitalization, death data: HealthData.gov, https://healthdata.gov/api/views/g62h-syeh/rows.csv?accessType=DOWNLOAD
	
	v2 Design:
	-Select states: 1-5 --> nest by state
	-Select data: case, death, hosp, vacc
	-Select metric: % Change (1 Year), 7-Day Average (Per 100k), 7-Day Average
	-Select dates: start date, # months
	
	
	- enter(). path, path, path, path for each metric with different classes: case, case-per, case-chg
*/


//alert("This alert box was called with the onload event");


////////////////////////////////////////////////////////////////////////
// GLOBALS

// title prefix
var titlePrefix = "Pandemic Comparison by Year: ";
var lastSeriesLength = 0;

// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 60},
    width = 800 - margin.left - margin.right,
    height = 350 - margin.top - margin.bottom;

var chartHeight = 350 - 75;

var titleDiv;

// color function
var colorByState;

// data globals
var hhsData;
var nytData;
var statePop;

var y, yAxis;
var x, xAxis;
var sumstat;
var uniqueSeries;

	
// date parser function
var parseDate = d3.timeParse("%Y/%m/%d");

// SELECT BUTTONS

// the currently selected group
groupSelected = "cases_ma";

// Map column names to user-friendly descriptions
var groups = {
	cases_ma : "Covid Cases",
	cases_100k_ma : "Covid Cases (per 100k)",
	ip_covid_ma : "Covid Hospitalized",
	ip_covid_100k_ma : "Covid Hospitalized (per 100k)",
	deaths_ma : "Covid Deaths",
	deaths_100k_ma : "Covid Deaths (per 100k)"
};

var decimals = {
	cases_ma : 0,
	cases_100k_ma : 0,
	ip_covid_ma : 0,
	ip_covid_100k_ma : 1,
	deaths_ma : 1,
	deaths_100k_ma : 2
};

var startMonths = {
	"May, 2021":"2021/05/01",
	"June, 2021":"2021/06/01",
	"July, 2021":"2021/07/01",
	"August, 2021":"2021/08/01",
	"September, 2021":"2021/09/01",
	"October, 2021":"2021/10/01",
	"November, 2021":"2021/11/01",
	"December, 2021":"2021/12/01"
};

// basic configuration
var defaultStatesSelected = ["MA","NH","XX","XX","XX"];
var statesSelected;
var defaultStartDate = "2021/06/01";
var endDate = new Date();
var paletteStr = "black,blue,brown,gray,red";

// our main d3 container
var svg;


// Credit: HealthData.gov: 
// Download: https://healthdata.gov/api/views/g62h-syeh/rows.csv?accessType=DOWNLOAD
//d3.csv("hhs_data_full.csv", hhsLoaded);

function startup(){
	// start with dynamic content hidden
	d3.select("#d3Content").style("display","none");

	// append the svg object to the body of the page
	svg = d3.select("div#container")
	  .append("svg")
	  .attr("preserveAspectRatio", "xMidYMid meet")
	  .attr("viewBox", "0 0 800 400")
	  .classed("svg-content", true)
	  .append("g")
	  .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")");
		  
	d3.select("#loadingMsg").html("Loading Hospitalization Data...");
	d3.csv("https://healthdata.gov/api/views/g62h-syeh/rows.csv?accessType=DOWNLOAD", hhsLoaded);
}

////////////////////////////////////////////////////////////////////////////////////////
// End of main script



/////////////////////////////////////////////////////////////////////////////////////////
// UTILITY FUNCTIONS


// Chained callback functions to read the data
function hhsLoaded(error, data) {
	console.log("hhsLoaded: " + data.length);
	hhsData =  data;
		
	d3.select("#loadingMsg").html("Loading Cases/Death Data...");
	d3.csv("https://seufet.github.io/viz/state_pop.csv", statePopLoaded);
}

function statePopLoaded(error, data) {
	statePop = data;
	console.log("statePopData: " + statePop.length);
	
	// Credit: NY Times, https://github.com/nytimes/covid-19-data
	// Download: https://raw.githubusercontent.com/nytimes/covid-19-data/master/rolling-averages/us-states.csv	
	//d3.csv("nyt_data.csv", loadPage);
	d3.select("#loadingMsg").html("Loading State Demographic Data...");
	d3.csv("https://raw.githubusercontent.com/nytimes/covid-19-data/master/rolling-averages/us-states.csv", loadPage);
}

// utility to set value of a select box
function selectElement(id, valueToSelect) {    
	let element = document.getElementById(id);
	if (element != null) element.value = valueToSelect;
}

function elementValue(id) {
	let element = document.getElementById(id);
	return element.value;
}

// Finish getting the page ready after our data sets are loaded
function loadPage(error, nyt) {
	// Update loader
	d3.select("#loadingMsg").html("Processing Data...");

	// pre-process the data sets
	nytData = nyt;
	console.log("nytData: " + nytData.length);
	
	// clean the state population info
	let popLookup = {};
	let stateNameLookup = {"None":"XX"};
	statePop.forEach(d => {
		d.population = d.population.replace(/,/g,""); // strip out any commas
		popLookup[d.state] = parseInt(d.population);
		stateNameLookup[d.full_name] = d.state;
		//console.log(d.full_name + "-" + d.state);
	});
	console.log("MA POP=" + popLookup["MA"]);

	// add the options to the data button
	d3.select("#selectButton")
	  .selectAll('myOptions')
		.data(Object.keys(groups))
	  .enter()
		.append('option')
	  .text(d => groups[d]) // text showed in the menu
	  .attr("value", d => d) // co2responding value returned by the button

	// add the options to the StartDate button
	d3.select("#startDateButton")
	  .selectAll('myOptions')
		.data(Object.keys(startMonths))
	  .enter()
		.append('option')
	  .text(d => d) // text showed in the menu
	  .attr("value", d => startMonths[d]) // co2responding value returned by the button

	// this just makes sure that "None" always sorts to the top
	stateSort = Object.keys(stateNameLookup).sort((a,b) => (a == "None" ? -1 : b == "None" ? 1 : a>b ? 1 : -1));
	d3.selectAll(".stateButton")
	  .selectAll('myOptions')
		.data(stateSort)
	  .enter()
		.append('option')
	  .text(d => d) // text showed in the menu
	  .attr("value", d => stateNameLookup[d]) // co2responding value returned by the button

	// default values for states
	statesSelected = defaultStatesSelected;
	for (i=0; i<statesSelected.length; i++){
		if (statesSelected[i] != null) {
			selectElement("state"+(i+1),statesSelected[i]);
		}
	}
	selectElement("startDateButton",defaultStartDate);

	// prepare a lookup for the nyt info, note we leave date as a yyyy-mm-dd string
	// nyt data set uses full state names, so we have to map
	let nytLookup = {};
	nytData.forEach(d => {
		let pk = stateNameLookup[d.state] + "-" + d.date;
		nytLookup[pk] = d;
	});
	
	// build a record lookup by date
	let hhsLookup = {};
	hhsData.forEach(function(d) {
		d.dateStr = d.date.replace(/\//g,"-"); // replace / with -
		d.surge = "Year 2";
		d.series = d.state + ", " + d.surge;
		d.date = parseDate(d.date);
		d.ip_covid = parseInt(d.inpatient_beds_used_covid);
		d.deaths_covid = parseInt(d.deaths_covid);
		
		nytRow = nytLookup[d.state + "-" + d.dateStr];
		if (nytRow != null) {
			d.cases = parseFloat(nytRow.cases);
			d.cases_ma = parseFloat(nytRow.cases_avg);
			d.cases_100k_ma = parseFloat(nytRow.cases_avg_per_100k);
			d.deaths = parseFloat(nytRow.deaths);
			d.deaths_ma = parseFloat(nytRow.deaths_avg);
			d.deaths_100k_ma = parseFloat(nytRow.deaths_avg_per_100k);
			//if (d.state == "MA") console.log(d.dateStr + "-" + d.cases);
		} else {
			//console.log("missing nyt data: " + d.state + "-" + d.dateStr);
		}
		
		pop = popLookup[d.state];
		d.ip_covid_100k = 100000*d.ip_covid/pop;
		d.deaths_covid_100k = 100000*d.deaths_covid/pop;
		d.pk = d.series + "-" + d.date.getTime();
		hhsLookup[d.pk] = d;
	});
	
	// prior year records
	let priorYear = [];
	
	// add records for the needed columns
	hhsData.forEach(function(d) {
		// make a copy of the data for a year earlier than d, and add it to the priorYear array with a modified state name
		// this enables us to have lines for the same state/date, but with the prior year records having a false date
		let priorDate = new Date(d.date.getFullYear()-1,d.date.getMonth(),d.date.getDate());
		let priorRow = Object.assign({}, hhsLookup[d.series+"-"+priorDate.getTime()]);
		
		// if prior row exists, add it to the priorYear array
		if (priorRow != null) {
			priorRow.surge = "Year 1";
			priorRow.series = d.state + ", " + priorRow.surge;
			priorRow.date = d.date;
			priorRow.dateStr = d.dateStr;
			priorRow.pk = priorRow.series + "-" + priorRow.date.getTime();
			priorYear.push(priorRow);
			d.prior = priorRow;
		}
	});
	console.log("data size: " + hhsData.length);
	console.log("priorYear size: " + priorYear.length);
	hhsData = hhsData.concat(priorYear);
	console.log("combined data size: " + hhsData.length);

	//////////////////////////////////////////////////////////////////
	// Hidden tooltip
	tooltip = d3.select("div#container").append("div")
		.attr('id', 'tooltip')
		.style('padding', 6)
		.style('display', 'none')

	//////////////////////////////////////////////////////////////////
	// Assign the event handlers
	
	// When new data is selected, run the update() function
    d3.select("#selectButton").on("change", function(d) {
        // recover the option that has been chosen and update
        groupSelected = d3.select(this).property("value")
        update()
    })
	// update if new state chosen
	d3.selectAll(".stateButton").on("change", function(d) {
        update()
    })
	// update if new startDate chosen
	d3.select("#startDateButton").on("change", function(d) {
        update()
    })

	// start off with a selection
	update();
	
	// We're finished loading! Hide loader, show content
	d3.select("#loadingContent").style("display","none");
	d3.select("#d3Content").style("display","block");
} // end of loadPage() 

// A function that updates the chart when the various controls change (date range, data set, etc)
function update() {
	console.log("update! groupSelected=" + groupSelected);
	var data = hhsData;

	// process state selections
	statesSelected = [];
	for (i=1; i<=5; i++){
		let v = elementValue("state"+i);
		//if (v != null && v != "XX"){
			statesSelected.push(v);
		//} 
	}

	// state palette
	colorByState = d3.scaleOrdinal()
	.domain(statesSelected)
	.range(paletteStr.split(","));
	
	// sort after assigning palette
	statesSelected.sort();
	
	// update title
	d3.select("div#chart-title")
		.html(titlePrefix + groups[groupSelected])
	
	// filter by date, state, etc
	// process the config
	startDate = parseDate(elementValue("startDateButton"));
	console.log("Start Date:" + startDate);
	
	let dataLowerLimit = new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()-7);
	data = data.filter(function(d,i){ return statesSelected.indexOf(d.state) >= 0 && d.date >= dataLowerLimit; });
	console.log("post size: " + data.length);
	
	// IMPORTANT: make sure we're still sorted by date, else the lines will scribble all over in the wrong order!
	data.sort((a, b) => (a.date > b.date) ? 1 : -1);
    
	//////////////////////////////////////////////////////////////////////////////////	
	// Compute 7-day moving averages for each series
		
	// get set of unique series
	uniqueSeries = Array.from(new Set(data.map(d => d.series)));
	uniqueSeries.sort();
	console.log(uniqueSeries);
	
	uniqueSeries.forEach(series => {
		maDays = 7;
		seriesData = data.filter(d => d.series == series);
		seriesData.sort((a, b) => (a.date > b.date) ? 1 : -1);
		//console.log(series + ": " + seriesData.length);
		seriesData[0].deaths_covid_rollsum = seriesData[0].deaths_covid;
		seriesData[0].ip_covid_rollsum = seriesData[0].ip_covid;
		seriesData[0].deaths_covid_100k_rollsum = seriesData[0].deaths_covid_100k;
		seriesData[0].ip_covid_100k_rollsum = seriesData[0].ip_covid_100k;
		for (var i = 1 ; i < seriesData.length ; i++) {
			seriesData[i].deaths_covid_rollsum = seriesData[i-1].deaths_covid_rollsum + seriesData[i].deaths_covid;
			seriesData[i].ip_covid_rollsum = seriesData[i-1].ip_covid_rollsum + seriesData[i].ip_covid;
			
			seriesData[i].deaths_covid_100k_rollsum = seriesData[i-1].deaths_covid_100k_rollsum + seriesData[i].deaths_covid_100k;
			seriesData[i].ip_covid_100k_rollsum = seriesData[i-1].ip_covid_100k_rollsum + seriesData[i].ip_covid_100k;
		}
		for (var i = 0 ; i < seriesData.length ; i++) {
			if (i<maDays) {
				seriesData[i].deaths_covid_ma = 0;
				seriesData[i].ip_covid_ma = 0;
				seriesData[i].deaths_covid_100k_ma = 0;
				seriesData[i].ip_covid_100k_ma = 0;
			}
			else {
				seriesData[i].deaths_covid_ma = (seriesData[i].deaths_covid_rollsum-seriesData[i-maDays].deaths_covid_rollsum)/maDays;
				seriesData[i].ip_covid_ma = (seriesData[i].ip_covid_rollsum-seriesData[i-maDays].ip_covid_rollsum)/maDays;
				seriesData[i].deaths_covid_100k_ma = (seriesData[i].deaths_covid_100k_rollsum-seriesData[i-maDays].deaths_covid_100k_rollsum)/maDays;
				seriesData[i].ip_covid_100k_ma = (seriesData[i].ip_covid_100k_rollsum-seriesData[i-maDays].ip_covid_100k_rollsum)/maDays;
			}
			//data[i].deaths_covid_rollsum = data[i-1].deaths_covid_rollsum + data[i].deaths_covid;
		}
	});
	

  // group the data: I want to draw one line per group
  sumstat = d3.nest() // nest function allows to group the calculation per level of a factor
	.key(function(d) { return d.series;})
    .entries(data);

	// update title
  d3.select("div#chart-title")
	.html(titlePrefix + groups[groupSelected])
	
  // Add X axis --> it is a date format
  plottedData = data.filter((d,i) => d.date >= startDate);
  svg.selectAll(".myXAxis").remove();
  x = d3.scaleTime()
    .domain(d3.extent(plottedData, function(d) { return d.date; }))
    .range([ 0, width ]);
  xAxis = d3.axisBottom(x).scale(x).tickFormat(d3.timeFormat("%b %d"));
  svg.append("g")
	.attr("class","myXAxis")
    .attr("transform", "translate(0," + (height-75) + ")")
    .call(xAxis);

  // Add Y axis
  y = d3.scaleLinear()
    .domain([0, d3.max(data, function(d) { return +d.ip_covid_ma; })])
    .range([ height-75, 0 ]);
  yAxis = d3.axisLeft().scale(y);
  svg.append("g")  
  .attr("class","myYaxis")
  .call(yAxis);

  ////////////////////////////////////////////////////////
  // tool-tip stuff

	// rebuild all tool-tip stuff from scratch on each call to update()
	svg.selectAll(".mouse-over-effects").remove();

  mouseG = svg.append("g")
	.attr("class", "mouse-over-effects");

  mouseG.append("path") // create vertical line to follow mouse
	.attr("class", "mouse-line")
	.style("stroke", "#A9A9A9")
	.style("stroke-width", "2px")
	.style("opacity", "0");

  // for the little circles on the vertical line
  var mousePerLine = mouseG.selectAll('.mouse-per-line')
	.data(sumstat)
	.enter()
	.append("g")
	.attr("class", "mouse-per-line");

  mousePerLine.append("circle")
	.attr("r", 4)
	.style("stroke", d => {
		return colorByState(d.key.substring(0,2));
	})
	.style("fill", "none")
	.style("stroke-width", "2px")
	.style("opacity", "0");

  mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
	.attr('width', width) 
	.attr('height', height)
	.attr('fill', 'none')
	.attr('pointer-events', 'all')
	.on('mouseout', function () { // on mouse out hide line, circles and text
	  d3.select(".mouse-line")
		.style("opacity", "0");
	  d3.selectAll(".mouse-per-line circle")
		.style("opacity", "0");
	  d3.selectAll(".mouse-per-line text")
		.style("opacity", "0");
	  d3.selectAll("#tooltip")
		.style('display', 'none')
	})
	.on('mouseover', () => { // on mouse in show line, circles and text
	  d3.select(".mouse-line")
		.style("opacity", "1");
	  d3.selectAll(".mouse-per-line circle")
		.style("opacity", "1");
	  d3.selectAll("#tooltip")
		.style('display', 'block')
	})
	.on('mousemove', function() { // update tooltip content, line, circles and text when mouse moves
		var mouse = d3.mouse(this);  
		var xDate = x.invert(mouse[0]); // get date corresponding to mouse x position
		
		// move the circles that highlight each point
		d3.selectAll(".mouse-per-line")
		.attr("transform", (d, i) => {
		  // find index in the data corresponding to the date/mouse position and position the circle x/y
		  var idx = d3.bisector(d => d.date).left(d.values, xDate);
		  return "translate(" + x(d.values[idx].date) + "," + y(d.values[idx][groupSelected]) + ")";
		}); // end attr statement
		
		// move the vertical line
		d3.select(".mouse-line")
			.attr("d", () => ("M" + x(xDate) + "," + (chartHeight-40) + " " + x(xDate) + "," + 0));
		
		// update the text in the box
		updateTooltipContent(mouse);
	})
	
	// update y axis (x axis stays same for now) with 1s transition
	y.domain([0, d3.max(data, d => +d[groupSelected]) ]);
	svg.selectAll(".myYaxis")
		.transition()
		.duration(1000)
		.call(yAxis);

	// if we have a different # of lines to draw, remove the old ones
	// otherwise we have extra lines hanging around if one or more are supposed to be removed
	if (uniqueSeries.length != lastSeriesLength){
		svg.selectAll(".lineTest").remove();
	}
	
	lastSeriesLength = uniqueSeries.length;
	var u = svg.selectAll(".lineTest").data(sumstat);
	
	  // Draw the lines
	  u.enter()
		.append("path")
		.attr("class","lineTest")
		.merge(u)
		.transition()
		.duration(1000)
		.attr("d", function(d){
			return d3.line()
				// this clips the lines so they won't go beyond the axis limit!
				.defined(d => d.date >= startDate)
				.x(function(d) { return x(d.date); })
				.y(function(d) { return y(+d[groupSelected]); })
				(d.values)
		})
	  .attr("fill", "none")
	  .attr("stroke", d => colorByState(d.key.substring(0,2)))
	  .style("stroke-width", 2)
	  // Year 2 not dashed, Year 1 dashed
		.style("stroke-dasharray", (d) => d.key.endsWith("Year 2") ? "3,0" : "3,3" )
	
	
	// Add a short line in the legend for each entry.
	console.log("UNIQUE SERIES: " + uniqueSeries);
	var lineLength = 20;
	var totalLength = 120;
	svg.selectAll(".legendLines").remove();
	legendLines = svg.selectAll(".legendLines").data(uniqueSeries);
	legendLines
	  .enter()
	  .append("line")
	  .merge(legendLines)
		.attr("class","legendLines")
		.attr("x1", (d,i) => i%2==0?50+totalLength*i/2:50+totalLength*(i-1)/2)
		.attr("x2", (d,i) => lineLength+(i%2==0?50+totalLength*i/2:50+totalLength*(i-1)/2))
		.attr("y1", d => d.endsWith("Year 1") ? height-40 : height-25)
		.attr("y2", d => d.endsWith("Year 1") ? height-40 : height-25)
		//.style("stroke", d => stateColors[d.substring(0,2)])
		.attr("stroke", d => colorByState(d.substring(0,2)))
		.style("stroke-width", 2)
		.style("stroke-dasharray", (d) => d.endsWith("Year 2") ? "3,0" : "3,3" )

	// Add legend text
	svg.selectAll(".legendText").remove();
	legendText = svg.selectAll(".legendText")
	  .data(uniqueSeries);
	 legendText
	  .enter()
	  .append("text")
		.merge(legendText)
		.attr("class","legendText")
		.attr("x", (d,i) => 5+lineLength+(i%2==0?50+totalLength*i/2:50+totalLength*(i-1)/2))
		.attr("y", d => d.endsWith("Year 1") ? height-39 : height-24)
		.style("fill", d => colorByState(d.substring(0,2)))
		.style("font", "12px times")
		.text(d => d) // text is the series name
		.attr("text-anchor", "left")
		.style("alignment-baseline", "middle")
		
	// compute max dates	
	console.log("hhs max date: " + d3.max(data, d => d.date));
	console.log("nyt max date: " + d3.max(nytData, d => d.date));
}

  
// This is called by the chart's mouse movement listener  
// to write the text that shows in the tooltip box
function updateTooltipContent(mouse) {
	// date for mouse x pos
	var xDate = x.invert(mouse[0])
	  
	// XXX this sorting can likely be simplified...we just want to sort by state abbreviation...
	// populate sortingObj with EACH match in the various groups
	sortingObj = []
	sumstat.map(d => {
	  var idx = d3.bisector(d => d.date).left(d.values, xDate);
	  sortingObj.push(
		{	
			key: d.values[idx].series, 
			num: d.values[idx][groupSelected],
			date: d.values[idx].date
		})
	}) // close map()

	// sort them by key, descending
	sortingObj.sort(function(x, y){
	   return d3.ascending(x.key, y.key);
	})

	// strip keys
	var sortingArr = sortingObj.map(d=> d.key)

	// sort by series title
	var sumstat1 = sumstat.slice().sort((a, b) => (sortingArr.indexOf(a.key) - sortingArr.indexOf(b.key)))

	//console.log("pageX=" + d3.event.pageX + " pageY=" + d3.event.pageY);

	/////////////////////////////////////////////////////////////////////
	// tooltip box text
	
	// date at the top and box position
	tooltip.html(sortingObj[0].date.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"}))
	  .style('left', (d3.event.pageX>500?d3.event.pageX-380:d3.event.pageX) + "px") // choose left or right of cursor depending on 
	  .style('top', (d3.event.pageY - 280) + "px")
	  .style('width', "300px")
	  .style('padding-bottom', "10px")
	  .selectAll()
	  .data(sumstat1).enter() // now a separate line for each series
	  .append('div')
	  .style('color', d => {
		var idx = d3.bisector(d => d.date).left(d.values, xDate);
		return colorByState(d.values[idx].state)
	  })
	  .html(d => {
		var idx = d3.bisector(d => d.date).left(d.values, xDate)
		var row = d.values[idx];
		if (row[groupSelected] == null) return "";	
		var pctChgMsg = "";
		if (row.surge == "Year 2" && row[groupSelected] != null && row.prior[groupSelected] != null){	
			let pctChg = 100*(row[groupSelected]/row.prior[groupSelected]-1);
			pctChgMsg = " (" + Math.abs(pctChg.toFixed(0)) + "% " + (pctChg>0 ? "Increase)" : "Decrease)");
		} 
		// show series, # of output variable with correct # decimal places
		return d.key + ": " + row[groupSelected].toFixed(decimals[groupSelected]) + pctChgMsg;
	  })
	  .style("font-size","16px")
	  .style("font-weight","normal")
}
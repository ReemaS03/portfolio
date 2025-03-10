let data = [];
let commits = [];  // Declare commits as a global variable
let xScale;
let yScale;
let selectedCommits = [];
let filteredCommits = []; 

async function loadData() {
    const tooltip = document.getElementById('commit-tooltip').hidden = true; // added to make tooltip disappear at the start

    data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line), // or just +row.line
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
      }));

    // processCommits();
    // console.log(commits);
    displayStats();
}

let commitProgress = 100;
let timeScale;
let commitMaxTime;
const selectedTime = d3.select('#selectedTime');

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  processCommits();
filteredCommits = filterCommitsByTime(); 

updateScatterplot(filteredCommits); 
brushSelector();

  timeScale = d3.scaleTime([d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)], [0, 100]);
  commitMaxTime = timeScale.invert(commitProgress);
  selectedTime.textContent = timeScale.invert(commitProgress).toLocaleString(undefined, {
              dateStyle: "long",
              timeStyle: "short"
          })
    d3.select("#commitSlider").on("input", function () {
        commitProgress = this.value;
        commitMaxTime = timeScale.invert(commitProgress);
        selectedTime.text(commitMaxTime.toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short"
        }));
        updateTimeDisplay();
    });
  });
  

function processCommits() {
commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
    let first = lines[0];
    let { author, date, time, timezone, datetime } = first;
    let ret = {
        id: commit,
        url: 'https://github.com/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
    };

    Object.defineProperty(ret, 'lines', {
        value: lines,
        // What other options do we need to set?
        // Hint: look up configurable, writable, and enumerable
        writable: true, // Allow the 'lines' property to be modified if needed
        enumerable: false, // This makes the 'lines' property invisible when logged or iterated
        configurable: true, // The property can be deleted or modified in the future
    });

    return ret;
    });
}

function displayStats() {
    // Process commits first
    processCommits();
  
    // Create the dl element
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
    // Add total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);
  
    // Add total commits
    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);
  
    // Add more stats as needed...
    // avg file length in lines
    const fileLengths = d3.rollups(
        data,
        (v) => d3.max(v, (v) => v.line),
        (d) => d.file
    );
    const averageFileLength = d3.mean(fileLengths, (d) => d[1]);

    // Time of day (morning, afternoon, evening, night) that most work is done
    const workByPeriod = d3.rollups(
        data,
        (v) => v.length,
        (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' })
    );
    const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];

    // numbe of files
    const numOfFiles = d3.group(data, d => d.file).size;

    // longest line
    const longestLine = d3.max(data, (d) => d.length);

    // Add Average File Length
    dl.append('dt').text('Average file length (lines)');
    dl.append('dd').text(averageFileLength.toFixed(2));

    // Add Time of day that most work is done
    dl.append('dt').text('Time of day most work is done');
    dl.append('dd').text(maxPeriod);

    // Add Number of files
    dl.append('dt').text('Number of files');
    dl.append('dd').text(numOfFiles);

    // Add Longest Line
    dl.append('dt').text('Longest line length');
    dl.append('dd').text(longestLine);
}
function filterCommitsByTime() {
    return commits.filter(commit => commit.datetime <= commitMaxTime); 
}

function updateScatterplot(filteredCommits) { // ✅ UPDATED: Use filtered commits
    d3.select('svg').remove(); // ✅ Clear previous scatterplot
    const width = 1000;
    const height = 600;
    const svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3.scaleTime()
        .domain(d3.extent(filteredCommits, (d) => d.datetime)) // ✅ UPDATED: Use `filteredCommits`
        .range([0, width])
        .nice();

    yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

    svg.selectAll('g').remove();
    const dots = svg.append('g').attr('class', 'dots');

    const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([5, 30]);

    dots.selectAll('circle').remove();
    dots.selectAll('circle')
        .data(filteredCommits) 
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('fill', 'steelblue')
        .attr('r', (d) => rScale(d.totalLines))
        .style('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
            updateTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
            d3.select(event.currentTarget).classed('selected', isCommitSelected(commit));
        })
        .on('mouseleave', () => {
            updateTooltipContent({});
            updateTooltipVisibility(false);
            d3.select(event.currentTarget).classed('selected', isCommitSelected(commit));
        });

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    xScale.range([margin.left, width - margin.right]);
    yScale.range([height - margin.bottom, margin.top]);
    // Add gridlines BEFORE the axes
    const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left}, 0)`);

    // Create gridlines as an axis with no labels and full-width ticks
    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-width));

    svg.append('g')
        .attr('transform', `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(xScale));

    svg.append('g')
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat(d => String(d).padStart(2, '0') + ':00'));
}

function updateTimeDisplay() {
    commitProgress = Number(d3.select("#commitSlider").property("value"));
    commitMaxTime = timeScale.invert(commitProgress);
    selectedTime.text(commitMaxTime.toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short"
    }));
    filteredCommits = filterCommitsByTime(); 
    updateScatterplot(filteredCommits);
}
function createScatterplot() {

    // Sort commits by total lines in descending order
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

    // Use sortedCommits in your selection instead of commits
    // dots.selectAll('circle').data(sortedCommits).join('circle');

    const width = 1000;
    const height = 600;
    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');
    xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([0, width])
        .nice();

    yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

    const dots = svg.append('g').attr('class', 'dots');
    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3
    .scaleSqrt() // Change only this line
    .domain([minLines, maxLines])
    .range([5, 30]);

    
    dots
        .selectAll('circle')
        .data(sortedCommits)
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('fill', 'steelblue')
        .attr('r', (d) => rScale(d.totalLines))
        .style('fill-opacity', 0.7) // Add transparency for overlapping dots
        .on('mouseenter', (event, commit) => {
            updateTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
            d3.select(event.currentTarget).classed('selected', isCommitSelected(commit)); 
        })
        .on('mouseleave', () => {
            updateTooltipContent({});
            updateTooltipVisibility(false);
            d3.select(event.currentTarget).classed('selected', isCommitSelected(commit)); 
        });

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };
      
    // Update scales with new ranges
    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);
    // Add gridlines BEFORE the axes
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);
    // Create gridlines as an axis with no labels and full-width ticks
    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
    // Create the axes
    const xAxis = d3.axisBottom(xScale);
    // const yAxis = d3.axisLeft(yScale);
    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');
    // Add X axis
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);

    // Add Y axis
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);
    
}

function updateTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
    const author = document.getElementById('commit-author');
    const time = document.getElementById('commit-time');
    const linesEdited = document.getElementById('commit-lines-edited');

    if (Object.keys(commit).length === 0) return;
  
    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
      dateStyle: 'full',
    });
    author.textContent = commit.author; 
    time.textContent = commit.datetime?.toLocaleString('en', { hour: '2-digit', minute: '2-digit' }); 
    linesEdited.textContent = commit.totalLines; 

}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
}

function brushSelector() {
    const svg = document.querySelector('svg');

    // Create brush
    d3.select(svg).call(d3.brush().on('start brush end', brushed));

    // Raise dots and everything after overlay
    d3.select(svg).selectAll('.dots, .overlay ~ *').raise();
}

// let brushSelection = null;

// function brushed(event) {
//   brushSelection = event.selection;
function brushed(evt) {
    let brushSelection = evt.selection;
    selectedCommits = !brushSelection
      ? []
      : filteredCommits.filter((commit) => {
          let min = { x: brushSelection[0][0], y: brushSelection[0][1] };
          let max = { x: brushSelection[1][0], y: brushSelection[1][1] };
          let x = xScale(commit.date);
          let y = yScale(commit.hourFrac);
  
          return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
        });
  updateSelection();
  updateSelectionCount();
  updateLanguageBreakdown();
}


function isCommitSelected(commit) {
    return selectedCommits.includes(commit);
  }

function updateSelection() {
  // Update visual state of dots based on selection
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
}

function updateSelectionCount() {
  
    const countElement = document.getElementById('selection-count');
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
}

function updateLanguageBreakdown() {

    const container = document.getElementById('language-breakdown');
  
    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);
  
    // Use d3.rollup to count lines per language
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type
    );
  
    // Update DOM with breakdown
    container.innerHTML = '';
  
    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);
  
      container.innerHTML += `
              <dt>${language}</dt>
              <dd>${count} lines (${formatted})</dd>
          `;
    }
  
    return breakdown;
}

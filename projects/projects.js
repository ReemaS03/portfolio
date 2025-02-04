// import * as d3 from 'd3';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
    projectsTitle.textContent = `${projects.length} Projects`;
}

let rolledData = d3.rollups(
    projects,
    (v) => v.length,
    (d) => d.year,
);
let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
});

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

let sliceGenerator = d3.pie().value((d) => d.value);
let arcData = sliceGenerator(data);
let arcs = arcData.map((d) => arcGenerator(d));

let colors = d3.scaleOrdinal(d3.schemePaired);

arcs.forEach((arc, idx) => {
    d3.select('svg')
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx)) // Fill in the attribute for fill color via indexing the colors variable
})

let legend = d3.select('.legend');
data.forEach((d, idx) => {
    legend.append('li')
          .attr('style', `--color:${colors(idx)}`) // set the style attribute while passing in parameters
          .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`); // set the inner html of <li>
})

let query = ''; 

function setQuery(newQuery) {
    query = newQuery;
    // Two thing should happen for this function:
    // 1) filter projects based on <query>, how can we do this?
    // 2) return filtered projects

    let filteredProjects = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
      });
      
    return filteredProjects;
  }
  
  let searchInput = document.getElementsByClassName('searchBar')[0];
  
  searchInput.addEventListener('input', (event) => {
    let filteredProjects = setQuery(event.target.value);
    
    // TODO: render updated projects!
    renderProjects(filteredProjects, projectsContainer, 'h2');

     // re-calculate rolled data
    let newRolledData = d3.rollups(
        filteredProjects,
        (v) => v.length,
        (d) => d.year,
    );

    // re-calculate data
    let newData = newRolledData.map(([year, count]) => {
        return { value: count, label: year }; // TODO
    });

    // re-calculate slice generator, arc data, arc, etc.
    let newSliceGenerator = d3.pie().value((d) => d.value);
    let newArcData = newSliceGenerator(newData); 
    let newArcs = newArcData.map((d) => arcGenerator(d));

    // TODO: clear up paths and legends
    let newSVG = d3.select('svg'); 
    newSVG.selectAll('path').remove();
    legend.selectAll('li').remove();

    // update paths and legends, refer to steps 1.4 and 2.2
    newArcs.forEach((arc, idx) => {
        newSVG
        .append('path')
        .attr('d', arc)
        .attr('fill', colors(idx)) // Fill in the attribute for fill color via indexing the colors variable
    })

    newData.forEach((d, idx) => {
        legend.append('li')
            .attr('style', `--color:${colors(idx)}`) // set the style attribute while passing in parameters
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`); // set the inner html of <li>
    })
});

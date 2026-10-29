const status = document.querySelector("#status");
const container = d3.select("#chart");

async function initialize() {
  try {
    const rows = await d3.csv("./data/climate_temperature.csv");

    const years = rows.columns
      .filter(column => /^\d{4}$/.test(column))
      .map(Number)
      .sort((a, b) => a - b);

    if (!rows.length || !years.length) {
      throw new Error("No data or year columns found.");
    }

    const locations = rows.map(row => ({
      name: row.Country,
      values: years.map(year => {
        const raw = (row[String(year)] ?? "").trim();

        return {
          year,
          value:
            raw !== "" && Number.isFinite(Number(raw))
              ? Number(raw)
              : null
        };
      })
    })).sort((a, b) => d3.ascending(a.name, b.name));

    container.selectAll("*").remove();

    // Location selector. Regional aggregates remain explicitly available.
    const controls = container.append("div")
      .style("margin-bottom", "24px");

    controls.append("label")
      .attr("for", "location-select")
      .style("font-weight", "600")
      .style("margin-right", "12px")
      .text("Country / territory / region");

    const select = controls.append("select")
      .attr("id", "location-select")
      .style("padding", "10px 12px")
      .style("max-width", "100%")
      .style("border", "1px solid #cbd5df")
      .style("border-radius", "8px")
      .style("font", "inherit")
      .style("background", "white")
      .style("color", "#172b3a");

    select.selectAll("option")
      .data(locations)
      .join("option")
      .attr("value", d => d.name)
      .text(d => d.name);

    const defaultLocation =
      locations.find(d => d.name === "World") ?? locations[0];

    select.property("value", defaultLocation.name);

    const heading = container.append("h2")
      .style("margin", "0 0 4px")
      .style("font-size", "22px");

    container.append("p")
      .style("margin", "0 0 16px")
      .style("font-size", "13px")
      .style("color", "#647582")
      .text(
        "Annual temperature anomaly relative to 1951–1980. " +
        "Gaps indicate missing observations; no smoothing is applied."
      );

    const width = 1000;
    const height = 460;
    const margin = { top: 30, right: 30, bottom: 55, left: 65 };

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .style("display", "block")
      .style("width", "100%");

    const description = svg.append("title");

    const x = d3.scaleLinear()
      .domain(d3.extent(years))
      .range([margin.left, width - margin.right]);

    // Keep one vertical scale across all location selections.
    const observed = locations.flatMap(location =>
      location.values
        .filter(d => d.value !== null)
        .map(d => d.value)
    );

    const y = d3.scaleLinear()
      .domain([
        Math.min(0, d3.min(observed)),
        Math.max(0, d3.max(observed))
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const grid = svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y)
          .ticks(6)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat("")
      );

    grid.select(".domain").remove();
    grid.selectAll("line").attr("stroke", "#e8edf1");

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")))
      .call(g => g.select(".domain").attr("stroke", "#cbd5df"))
      .call(g => g.selectAll(".tick line").remove());

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").remove());

    svg.selectAll(".tick text")
      .attr("fill", "#647582")
      .style("font-size", "12px");

    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 16)
      .attr("fill", "#526575")
      .style("font-size", "12px")
      .text("Temperature anomaly (°C)");

    svg.append("text")
      .attr("x", width - margin.right)
      .attr("y", height - 10)
      .attr("text-anchor", "end")
      .attr("fill", "#526575")
      .style("font-size", "12px")
      .text("Year");

    svg.append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#8997a1")
      .attr("stroke-dasharray", "4 4");

    const line = d3.line()
      .defined(d => d.value !== null)
      .x(d => x(d.year))
      .y(d => y(d.value));

    const path = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", "#7952B3")
      .attr("stroke-width", 2.5)
      .attr("stroke-linejoin", "round");

    const points = svg.append("g");

    function update() {
      const location = locations.find(
        d => d.name === select.property("value")
      );

      heading.text(location.name);

      description.text(
        `Annual temperature anomalies for ${location.name}, ` +
        `${years[0]} to ${years[years.length - 1]}, in degrees Celsius.`
      );

      path.datum(location.values).attr("d", line);

      points.selectAll("circle")
        .data(location.values.filter(d => d.value !== null))
        .join("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("r", 3)
        .attr("fill", "#26756c")
        .selectAll("title")
        .data(d => [d])
        .join("title")
        .text(d => `${d.year}: ${d3.format("+.3f")(d.value)} °C`);

      const available = location.values.filter(
        d => d.value !== null
      ).length;

      status.textContent =
        `${location.name}: ${available} of ${years.length} ` +
        "annual observations available. " +
        "The vertical scale stays fixed when you change locations.";
    }

    select.on("change", update);
    update();

  } catch (error) {
    console.error(error);
    status.textContent =
      "Could not build the chart. Check the browser console " +
      "and the CSV filename.";
  }
}

initialize();
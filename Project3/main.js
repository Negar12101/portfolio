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

    const firstYear = years[0];
    const lastYear = years[years.length - 1];

    // Keep missing observations as null, rather than zero.
    const locations = rows.map(row => ({
      name: row.Country,
      iso3: row.ISO3,
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

    const observed = locations.flatMap(location =>
      location.values
        .filter(d => d.value !== null)
        .map(d => d.value)
    );

    if (!observed.length) {
      throw new Error("No numeric temperature observations found.");
    }

    const colors = ["#7952B3", "#C16A20"];
    const formatValue = d3.format("+.3f");

    container.selectAll("*").remove();

    // Shared styling for all dropdown menus.
    function styleSelect(select) {
      return select
        .style("padding", "10px 12px")
        .style("border", "1px solid #d4c6e9")
        .style("border-radius", "8px")
        .style("font", "inherit")
        .style("background", "#faf8fe")
        .style("color", "#45345f")
        .style("max-width", "100%");
    }

    // LOCATION CONTROLS
    const controls = container.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "16px")
      .style("margin-bottom", "24px");

    function createLocationSelect(label, id, color) {
      const group = controls.append("div")
        .style("flex", "1 1 240px")
        .style("min-width", "0");

      group.append("label")
        .attr("for", id)
        .style("display", "block")
        .style("margin-bottom", "8px")
        .style("font-weight", "600")
        .style("color", color)
        .text(label);

      const select = styleSelect(
        group.append("select").attr("id", id)
      ).style("width", "100%");

      select.selectAll("option")
        .data(locations)
        .join("option")
        .attr("value", d => d.name)
        .text(d => d.name);

      return select;
    }

    const firstSelect = createLocationSelect(
      "Location A · solid line",
      "location-a",
      colors[0]
    );

    const secondSelect = createLocationSelect(
      "Location B · dashed line",
      "location-b",
      colors[1]
    );

    const firstDefault =
      locations.find(d => d.iso3 === "USA") ?? locations[0];

    const secondDefault =
      locations.find(d => d.iso3 === "CAN") ??
      locations.find(d => d.name !== firstDefault.name) ??
      firstDefault;

    firstSelect.property("value", firstDefault.name);
    secondSelect.property("value", secondDefault.name);

    container.append("h2")
      .style("margin", "0 0 8px")
      .style("font-size", "22px")
      .text("Compare annual temperature anomalies");

    container.append("p")
      .style("margin", "0 0 20px")
      .style("font-size", "13px")
      .style("color", "#68637c")
      .text(
        "Choose two countries, territories, or regional aggregates. " +
        "Both lines share the same axes. Missing observations create " +
        "gaps; no smoothing is applied."
      );

    // TIME CONTROLS
    const timeControls = container.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "end")
      .style("gap", "16px")
      .style("margin-bottom", "20px");

    function createYearSelect(label, id, initialYear) {
      const group = timeControls.append("div");

      group.append("label")
        .attr("for", id)
        .style("display", "block")
        .style("margin-bottom", "6px")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .text(label);

      const select = styleSelect(
        group.append("select").attr("id", id)
      );

      select.selectAll("option")
        .data(years)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      select.property("value", initialYear);

      return select;
    }

    const startSelect = createYearSelect(
      "From", "start-year", firstYear
    );

    const endSelect = createYearSelect(
      "To", "end-year", lastYear
    );

    const resetButton = timeControls.append("button")
      .attr("type", "button")
      .style("padding", "10px 16px")
      .style("border", "1px solid #d4c6e9")
      .style("border-radius", "8px")
      .style("background", "#ede7f7")
      .style("color", "#514174")
      .style("font", "inherit")
      .style("cursor", "pointer")
      .text("Reset years");

    // LEGEND
    const legend = container.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "12px 24px")
      .style("margin-bottom", "12px");

    // CHART
    const width = 1000;
    const height = 460;
    const margin = {
      top: 30,
      right: 30,
      bottom: 55,
      left: 65
    };

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-labelledby", "temperature-chart-title")
      .style("display", "block")
      .style("width", "100%");

    const description = svg.append("title")
      .attr("id", "temperature-chart-title");

    const x = d3.scaleLinear()
      .domain([firstYear, lastYear])
      .range([margin.left, width - margin.right]);

    // Keep the vertical scale fixed across locations and time windows.
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
    grid.selectAll("line").attr("stroke", "#ece8f2");

    const xAxis = svg.append("g")
      .attr(
        "transform",
        `translate(0,${height - margin.bottom})`
      );

    const yAxis = svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6));

    yAxis.select(".domain").remove();
    yAxis.selectAll(".tick line").remove();
    yAxis.selectAll(".tick text")
      .attr("fill", "#68637c")
      .style("font-size", "12px");

    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 16)
      .attr("fill", "#68637c")
      .style("font-size", "12px")
      .text("Temperature anomaly (°C)");

    svg.append("text")
      .attr("x", width - margin.right)
      .attr("y", height - 10)
      .attr("text-anchor", "end")
      .attr("fill", "#68637c")
      .style("font-size", "12px")
      .text("Year");

    // Baseline reference.
    svg.append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#9690a5")
      .attr("stroke-dasharray", "4 4");

    const line = d3.line()
      .defined(d => d.value !== null)
      .x(d => x(d.year))
      .y(d => y(d.value));

    const seriesLayer = svg.append("g");

    container.append("p")
      .style("margin", "10px 0 0")
      .style("font-size", "12px")
      .style("color", "#777187")
      .text(
        "Hover over a point to see its year and value. " +
        "Zero represents the 1951–1980 average, not an absolute " +
        "temperature of 0°C."
      );

    // UPDATE CHART
    function update() {
      const startYear = Number(startSelect.property("value"));
      const endYear = Number(endSelect.property("value"));

      // Disable invalid choices so the displayed chart and controls agree.
      startSelect.selectAll("option")
        .property("disabled", d => d >= endYear);

      endSelect.selectAll("option")
        .property("disabled", d => d <= startYear);

      x.domain([startYear, endYear]);

      // Use integer years, including both endpoints.
      const tickCount = Math.min(8, endYear - startYear);
      const tickYears = Array.from(new Set([
        startYear,
        ...x.ticks(tickCount).filter(Number.isInteger),
        endYear
      ])).sort((a, b) => a - b);

      xAxis.call(
        d3.axisBottom(x)
          .tickValues(tickYears)
          .tickFormat(d3.format("d"))
      );

      xAxis.selectAll(".tick line").remove();
      xAxis.select(".domain").attr("stroke", "#cbd5df");
      xAxis.selectAll(".tick text")
        .attr("fill", "#68637c")
        .style("font-size", "12px");

      const selected = [
        locations.find(
          d => d.name === firstSelect.property("value")
        ),
        locations.find(
          d => d.name === secondSelect.property("value")
        )
      ];

      const series = selected.map((location, index) => ({
        ...location,
        values: location.values.filter(
          d => d.year >= startYear && d.year <= endYear
        ),
        slot: index,
        color: colors[index]
      }));

      // Draw actual line samples in the legend.
      const legendItems = legend.selectAll("div.legend-item")
        .data(series, d => d.slot)
        .join(enter => {
          const item = enter.append("div")
            .attr("class", "legend-item")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "8px");

          item.append("svg")
            .attr("width", 32)
            .attr("height", 12)
            .attr("aria-hidden", "true")
            .append("line")
            .attr("x1", 0)
            .attr("x2", 32)
            .attr("y1", 6)
            .attr("y2", 6)
            .attr("stroke-width", 2.5);

          item.append("span")
            .style("font-size", "13px")
            .style("font-weight", "600");

          return item;
        });

      legendItems.select("line")
        .attr("stroke", d => d.color)
        .attr(
          "stroke-dasharray",
          d => d.slot === 1 ? "7 4" : null
        );

      legendItems.select("span")
        .style("color", d => d.color)
        .text(d => d.name);

      description.text(
        `Annual temperature anomalies for ${selected[0].name} ` +
        `and ${selected[1].name}, ${startYear}–${endYear}, ` +
        "in degrees Celsius relative to 1951–1980."
      );

      const groups = seriesLayer.selectAll("g.series")
        .data(series, d => d.slot)
        .join("g")
        .attr("class", "series");

      groups.each(function(series) {
        const group = d3.select(this);

        group.selectAll("path.temperature-line")
          .data([series.values])
          .join("path")
          .attr("class", "temperature-line")
          .attr("fill", "none")
          .attr("stroke", series.color)
          .attr("stroke-width", 2.5)
          .attr(
            "stroke-dasharray",
            series.slot === 1 ? "7 4" : null
          )
          .attr("stroke-linejoin", "round")
          .attr("d", line);

        group.selectAll("circle")
          .data(
            series.values.filter(d => d.value !== null),
            d => d.year
          )
          .join("circle")
          .attr("cx", d => x(d.year))
          .attr("cy", d => y(d.value))
          .attr("r", 3)
          .attr("fill", series.color)
          .selectAll("title")
          .data(d => [d])
          .join("title")
          .text(d =>
            `${series.name}\n${d.year}: ` +
            `${formatValue(d.value)} °C`
          );
      });

      const expectedYears = endYear - startYear + 1;

      const counts = series.map(location => {
        const available = location.values.filter(
          d => d.value !== null
        ).length;

        return (
          `${location.name}: ` +
          `${available}/${expectedYears} years`
        );
      });

      status.textContent =
        `${startYear}–${endYear} · ` +
        counts.join(" · ") +
        ". The vertical scale remains fixed across selections." +
        (selected[0].name === selected[1].name
          ? " The same location is selected twice; the lines overlap."
          : "");
    }

    firstSelect.on("change", update);
    secondSelect.on("change", update);
    startSelect.on("change", update);
    endSelect.on("change", update);

    resetButton.on("click", () => {
      startSelect.property("value", firstYear);
      endSelect.property("value", lastYear);
      update();
    });

    update();

  } catch (error) {
    console.error(error);

    status.textContent =
      "Could not build the chart. Check the CSV filename, " +
      "internet connection, and browser console. " +
      "Open this page using Live Server.";
  }
}

initialize();
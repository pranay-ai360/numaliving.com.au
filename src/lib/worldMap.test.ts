import { describe, expect, it } from "vitest";
import { LAND_PATH, MAP_HEIGHT, MAP_WIDTH, mapX, mapY } from "@/lib/worldMap";

const NORTH_EDGE_LATITUDE = 84;
const SOUTH_EDGE_LATITUDE = -58;
const WEST_EDGE_LONGITUDE = -180;
const EAST_EDGE_LONGITUDE = 180;

/** Counts how many times a single character occurs in a string. */
function countOf(character: string, text: string): number {
  return text.split(character).length - 1;
}

describe("map edges", () => {
  it("spans the full width between the west and east edges", () => {
    // Arrange
    const west = WEST_EDGE_LONGITUDE;
    const east = EAST_EDGE_LONGITUDE;

    // Act
    const edges = [mapX(west), mapX(east)];

    // Assert
    expect(edges).toEqual([0, MAP_WIDTH]);
  });

  it("spans the full height between the north and south edges, to the nearest unit", () => {
    // Arrange
    const north = NORTH_EDGE_LATITUDE;
    const south = SOUTH_EDGE_LATITUDE;

    // Act
    const edges = [mapY(north), Math.round(mapY(south))];

    // Assert
    expect(edges).toEqual([0, MAP_HEIGHT]);
  });
});

describe("mapX", () => {
  it.each([
    [-180, 0],
    [0, 500],
    [180, 1000],
  ])("maps longitude %d to x = %d", (longitude, expectedX) => {
    // Arrange
    // (the table above supplies the longitude)

    // Act
    const x = mapX(longitude);

    // Assert
    expect(x).toBeCloseTo(expectedX, 2);
  });

  it("maps the longitude of Dubai to x = 653.53", () => {
    // Arrange
    const dubaiLongitude = 55.27;

    // Act
    const x = mapX(dubaiLongitude);

    // Assert
    expect(x).toBeCloseTo(653.53, 2);
  });

  it("moves right as the longitude increases eastwards", () => {
    // Arrange
    const west = -10;
    const east = 10;

    // Act
    const isEastOfWest = mapX(east) > mapX(west);

    // Assert
    expect(isEastOfWest).toBe(true);
  });
});

describe("mapY", () => {
  it.each([
    [84, 0],
    [0, 233.33],
    [-58, 394.44],
  ])("maps latitude %d to y = %d", (latitude, expectedY) => {
    // Arrange
    // (the table above supplies the latitude)

    // Act
    const y = mapY(latitude);

    // Assert
    expect(y).toBeCloseTo(expectedY, 2);
  });

  it("maps the latitude of Dubai to y = 163.33", () => {
    // Arrange
    const dubaiLatitude = 25.2;

    // Act
    const y = mapY(dubaiLatitude);

    // Assert
    expect(y).toBeCloseTo(163.33, 2);
  });

  it("moves down as the latitude decreases southwards", () => {
    // Arrange
    const north = 10;
    const south = -10;

    // Act
    const isSouthBelowNorth = mapY(south) > mapY(north);

    // Assert
    expect(isSouthBelowNorth).toBe(true);
  });
});

describe("LAND_PATH", () => {
  it("is SVG path data made only of move, line and close commands", () => {
    // Arrange
    const pathData = LAND_PATH;

    // Act
    const isWellFormed = /^M[MLZ0-9.,-]+Z$/.test(pathData);

    // Assert
    expect(isWellFormed).toBe(true);
  });

  it("closes every sub-path it opens", () => {
    // Arrange
    const pathData = LAND_PATH;

    // Act
    const opened = countOf("M", pathData);
    const closed = countOf("Z", pathData);

    // Assert
    expect(opened).toBeGreaterThan(0);
    expect(closed).toBe(opened);
  });
});

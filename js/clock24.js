class Angle {
  constructor(radians) {
    this.value = radians;
  }

  static fromDegrees(degrees) {
    const angle = new Angle();
    angle.degrees = degrees;
    return angle;
  }

  set degrees(degrees) {
    this.value = (degrees - 360 / 4) * Math.PI / 180;
  }

  get degrees() {
    return this.value * 180 / Math.PI + 360 / 4;
  }

  get radians() {
    return this.value;
  }
}

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  static fromPolar(center, angle, radius) {
    return new Point(
      center.x + (radius * Math.cos(angle.radians)),
      center.y + (radius * Math.sin(angle.radians))
    );
  }
}

class Hand {
  constructor(element, center, radius, maximum) {
    this.element = element;
    this.center = center;
    this.radius = radius;
    this.maximum = maximum;
  }

  set value(value) {
    const angle = Angle.fromDegrees(value / this.maximum * 360);
    const tip = Point.fromPolar(this.center, angle, this.radius);
    this.element.setAttribute('x2', tip.x);
    this.element.setAttribute('y2', tip.y);
  }

  addBand(svgDocument, element, radius, formatter) {
    for (let i = 1; i <= this.maximum; i++) {
      const numeral = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'text');
      const angle = Angle.fromDegrees(i / this.maximum * 360);
      const tip = Point.fromPolar(this.center, angle, radius);
      numeral.setAttribute('x', tip.x);
      numeral.setAttribute('y', tip.y);
      numeral.innerHTML = formatter(i);
      element.appendChild(numeral);
    }
  }
}

class Clock {
  constructor(svgDocument) {
    this.svgDocument = svgDocument;
    const center = new Point(svgDocument.rootElement.viewBox.baseVal.width / 2, svgDocument.rootElement.viewBox.baseVal.height / 2);
    const radius = Math.min(center.x, center.y);
    this.center = center;
    this.radius = radius;
    this.hands = [
      new Hand(svgDocument.getElementById('short-hand'), center, radius * 0.5, 24),
      new Hand(svgDocument.getElementById('long-hand'), center, radius * 0.75, 24),
      new Hand(svgDocument.getElementById('fast-hand'), center, radius * 0.75, 24),
    ];

    this.hands[0].addBand(svgDocument, svgDocument.getElementById('hours'), radius * 0.75, value =>
      balance(value, -24)
    );

    setInterval(this.tick.bind(this), 10);

    navigator.geolocation.watchPosition(position => {
      this.getSunTimes(position.coords.latitude, position.coords.longitude);
    });
  }

  getHours(now) {
    now = now || new Date();
    return (now.getHours() + ((now.getMinutes() + ((now.getSeconds() + now.getMilliseconds() / 1000) / 60)) / 60));
  }

  get hours() {
    return this.getHours();
  }

  updateDaylight() {
    const sunrise = Angle.fromDegrees(this.sunrise / 24 * 360);
    const sunset = Angle.fromDegrees(this.sunset / 24 * 360);

    const a = Point.fromPolar(this.center, sunset, this.radius);
    const b = Point.fromPolar(this.center, sunrise, this.radius);
    const c = Point.fromPolar(this.center, sunset, this.radius - 35);
    const d = Point.fromPolar(this.center, sunrise, this.radius - 35);

    const largeArcFlag = sunset.degrees - sunrise.degrees <= 180 ? 0 : 1;

    this.svgDocument.getElementById('daylight').setAttribute('d', `
      M ${a.x} ${a.y}
      A ${this.radius} ${this.radius} 0 ${largeArcFlag} 0 ${b.x} ${b.y}
      L ${this.center.x} ${this.center.y}
      Z
      M ${c.x} ${c.y}
      A ${this.radius - 35} ${this.radius - 35} 0 ${largeArcFlag} 0 ${d.x} ${d.y}
      L ${this.center.x} ${this.center.y}
      Z`);

    document.getElementById("daylight").setAttribute("d", d);
  }

  getSunTimes(lat, lng) {
    const clock = this;
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        const response = JSON.parse(this.responseText);
        clock.sunrise = clock.getHours(new Date(response.results.sunrise));
        clock.sunset = clock.getHours(new Date(response.results.sunset));
        clock.updateDaylight();
      }
    };
    xhttp.open("GET", `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`, true);
    xhttp.send();
  }

  tick() {
    const now = this.hours;
    for (let i in this.hands) {
      const hand = this.hands[i];
      hand.value = now * Math.pow(24, i);
    }
    this.svgDocument.getElementById('counter').innerHTML = balance(now, -24);
  }
}

function negate(n) {
  return `<tspan class="negative">${n}</tspan>`;
}

function balance(n, base) {
  const string = (n % -base).toString(-base).replace(/(\..+$)/, frac => frac.substring(0, 4));
  let conversion = '';
  let carry = false;
  for (let i = string.length - 1; i >= 0; i--) {
    if (string[i] == '.') {
      conversion = '.' + conversion;
      continue;
    }

    let digit = parseInt(string[i], -base);
    if (carry) {
      digit++;
      carry = false;
    }

    if (digit > -base / 2) {
      carry = true;
      digit = -base - digit;
      conversion = negate(digit.toString(-base).toUpperCase()) + conversion;
    } else {
      conversion = digit.toString(-base).toUpperCase() + conversion;
    }
  }
  if (carry) {
    // Intentionally drop the inherit "day"
    // conversion = '1' + conversion;
  }
  return conversion
    .replace(/A/g, 'Ⅹ')
    .replace(/B/g, '↋')
    .replace(/C/g, '↊');
}

const object = document.getElementById('clock24');
object.addEventListener('load', function () {
  const clock = new Clock(object.contentDocument);
}, false);

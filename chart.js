const VIDEO_PATH = 'data/videos.json'
const FACE_PATH_PREFIX = 'data/faces/'

const BTN_EXPANDED = '&#9652;';
const BTN_HIDDEN = '&#9662;';

const DEFAULT_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];
const WIDTH_VEGA_CHART = 800;
const HEIGHT_VEGA_CHART = 200;

function formatName(s) {
  return s.split('-').map(t => t.slice(0, 1).toUpperCase() + t.slice(1)).join(' ');
}


function getColor(i) {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}


function convertHex(hex, a){
    hex = hex.replace('#', '');
    r = parseInt(hex.substring(0,2), 16);
    g = parseInt(hex.substring(2,4), 16);
    b = parseInt(hex.substring(4,6), 16);
    return `rgba(${r},${g},${b},${a})`;
}


function toDecimal(n, k) {
  if (k === undefined) {
    k = 2;
  }
  return n.toLocaleString(undefined, {maximumFractionDigits: k});
}


function getEasternDate(ymd, hms) {
  let year = parseInt(ymd.slice(0, 4));
  let month = parseInt(ymd.slice(4, 6));
  let day = parseInt(ymd.slice(6));
  let hour = parseInt(hms.slice(0, 2));
  let min = parseInt(hms.slice(2, 4));
  let sec = parseInt(hms.slice(4));
  let date = new Date(year, month, day, hour, min, sec);
  return date.toLocaleString('en-US', {timeZone: 'America/New_York'}).split(',')[0];
}


function parseVideoName(video_id, video_name, width, height, fps) {
  // Splits a video name into parts
  let tokens = video_name.split('_');
  var channel = tokens[0];
  if (channel.endsWith('W')) {
    channel = channel.substring(0, channel.length - 1);
  }
  var date = tokens[1];
  var time = tokens[2];
  var show = '';
  if (tokens.length > 3) {
    show = tokens.slice(3).join('_');
  }
  let [month, day, year] = getEasternDate(date, time).split('/');
  return {
    id: video_id,
    name: video_name,
    channel: channel,
    show: show,
    year: year,
    month: `${month}/${year}`,
    day: `${month}/${day}/${year}`,
    width: width,
    height: height,
    fps: fps
  };
}


function joinFacesWithVideos(videos, faces) {
  let face_video_set = faces.reduce(
    (acc, f) => {
      acc.add(f.video_id);
      return acc;
    }, new Set());
  let video_dict = videos.reduce((acc, v) => {
    if (face_video_set.has(v[0])) {
      // id, name, width, height, fps
      acc[v[0]] = parseVideoName(...v);
    }
    return acc;
  }, {});
  return faces.map(face => {
    return {
      id: face.face_id, t: face.t, cluster_id: face.cluster_id,
      x1: face.x1, x2: face.x2, y1: face.y1, y2: face.y2,
      video: video_dict[face.video_id]
    };
  });
}


function init(person_name, callback) {
  $.get(VIDEO_PATH, function(videos) {
    $.get(FACE_PATH_PREFIX + `${person_name}.json`,
      function(faces) {
        callback(joinFacesWithVideos(videos, faces));
      }
    );
  });
}


function mapKVToJQueryElements(key, value, name) {
  return $('<span>').addClass('kv-span').append(
    $('<span>').addClass('key').text(key),
    value ? $('<span>').addClass('value').attr(
      name ? {name: name} : {}
    ).text(value) : null
  );
}


const ARCHIVE_ENDPOINT = 'https://ia801301.us.archive.org/0/items';
var FRAME_SERVER_ENDPOINT;
$.get('frameserver.txt', function(data) {
  FRAME_SERVER_ENDPOINT = $.trim(data);
});

const VIDEO_HEIGHT = 160;


function getCroppedFaceCanvas(face, thumb_url) {
  let canvas = $('<canvas>').attr(
    {width: VIDEO_HEIGHT, height: VIDEO_HEIGHT, title: 'Click for video!'}
  ).click(function() {
    let aspect_ratio = face.video.width / face.video.height;
    let vblock = canvas.closest('.vblock');
    vblock.prepend(getVideo(face, thumb_url));
    vblock.find('.vinfo').css('max-width', VIDEO_HEIGHT / aspect_ratio);
    canvas.remove();
  });
  let img = new Image();
  img.onload = function() {
    let face_width = Math.ceil((face.x2 - face.x1) * this.width);
    let face_height = Math.ceil((face.y2 - face.y1) * this.height);
    canvas[0].getContext('2d').drawImage(
      img, face.x1 * this.width, face.y1 * this.height,
      face_width, face_height, 0, 0, VIDEO_HEIGHT, VIDEO_HEIGHT);
  }
  img.src = thumb_url;
  return canvas;
}


function getVideo(face, thumb_url) {
  let time = face.t / face.video.fps;
  let t0 = Math.max(time - 89, 0);
  let t1 = t0 + 179;

  let play_time = time - t0;
  let resetPlayTime = function() { $(this)[0].currentTime = play_time; };

  let aspect_ratio = face.video.width / face.video.height;
  let video_url = `${ARCHIVE_ENDPOINT}/${face.video.name}/${face.video.name}.mp4?start=${t0}&end=${t1}&exact=1&ignore=x.mp4`;
  return $('<video controls>').attr({
    preload: 'none', width: VIDEO_HEIGHT / aspect_ratio, height: VIDEO_HEIGHT,
    poster: thumb_url, src: video_url
  }).on('loadeddata', resetPlayTime).on('pause', resetPlayTime);
}


function getFaceToJQueryElementMapper(crop_faces) {
  return function(face) {
    let time = face.t / face.video.fps;
    let aspect_ratio = face.video.width / face.video.height;
    let thumb_url = `${FRAME_SERVER_ENDPOINT}/fetch?path=tvnews/videos/${face.video.name}.mp4&frame=${face.t}`;
    return $('<div>').addClass('vblock').append(
      crop_faces ? getCroppedFaceCanvas(face, thumb_url) :getVideo(face, thumb_url),
      $('<div>').addClass('vinfo').css({
        'max-width': crop_faces ? VIDEO_HEIGHT : VIDEO_HEIGHT / aspect_ratio,
        'font-size': 'x-small'
      }).append(
        $('<span>').css('overflow-x', 'hidden').text(face.video.name),
        $('<span>').text(`t: ${Math.floor(time)}s, face id: ${face.id}`)
      ),
    );
  }
}


/* Sorts a list of [k, value list] by desending value list length */
function sortEntriesByValueListLen(a, b) {
  return b[1].length - a[1].length;
}


function facesToSeconds(faces) {
  return faces.length * 3;
}


function getSliceByVideoPropertyReducer(video_property) {
  return (acc, face) => {
    let key = face.video[video_property];
    if (acc.hasOwnProperty(key)) {
      acc[key].push(face);
    } else {
      acc[key] = [face];
    }
    return acc;
  }
}


function sliceByClusterIdReducer(acc, face) {
  let k = `Cluster ${face.cluster_id}`;
  if (acc.hasOwnProperty(k)) {
    acc[k].push(face);
  } else {
    acc[k] = [face];
  }
  return acc;
}


function sliceFaceList(faces, slice_by) {
  if (slice_by == '') {
    slices = {'': faces};
  } else if (slice_by == 'cluster') {
    slices = faces.reduce(sliceByClusterIdReducer, {});
  } else {
    slices = faces.reduce(getSliceByVideoPropertyReducer(slice_by), {});
  }
  return slices;
}


function getUniqueCountByVideoProperty(faces, video_property) {
  return faces.reduce((acc, f) => {
    acc.add(f.video[video_property]);
    return acc;
  }, new Set()).size;
}


function mapL1SliceToJQueryElements(
  l1_slice_faces, slice_by_l2, roll_up_percentage, crop_faces,
  n_faces_in_total, l1_slice_name,
) {
  let n_faces_in_l1_slice = l1_slice_faces.length;
  let min_faces_in_l2_slice = roll_up_percentage / 100 * n_faces_in_l1_slice;

  let l2_slices = sliceFaceList(l1_slice_faces, slice_by_l2);
  let l2_slices_arr = Object.entries(l2_slices).sort(
    sortEntriesByValueListLen
  );

  function renderL2Slice(l2_slice) {
    let [l2_slice_name, l2_slice_faces] = l2_slice;
    let l2_slice_seconds = facesToSeconds(l2_slice_faces);

    let sampleAndRenderVideos = function() {
      let sampled_faces = _.sampleSize(l2_slice_faces, 10);
      return sampled_faces.map(getFaceToJQueryElementMapper(crop_faces));
    };

    let init_sample = sampleAndRenderVideos();

    return $('<div>').addClass('l2-slice-div').append(
      $('<div>').addClass('kv-div').append(
        slice_by_l2 ? [
          mapKVToJQueryElements(l2_slice_name),
          mapKVToJQueryElements(
            'Screen time',
            `${toDecimal(l2_slice_seconds / 60)} min`
          ),
          mapKVToJQueryElements(
            `Percent of "${l1_slice_name}" time`,
            `${toDecimal(l2_slice_faces.length / n_faces_in_l1_slice * 100)} %`
          ),
          mapKVToJQueryElements(
            'Percent of total screen time',
            `${toDecimal(l2_slice_faces.length / n_faces_in_total * 100)} %`
          ),
          mapKVToJQueryElements(
            'Number of videos',
            getUniqueCountByVideoProperty(l2_slice_faces, 'id')
          ),
          mapKVToJQueryElements(
            'Number of days',
            getUniqueCountByVideoProperty(l2_slice_faces, 'day')
          ),
          mapKVToJQueryElements(
            'Number of samples', init_sample.length, 'n-samples-value'
          ),
          $('<button>').addClass(
            'btn btn-secondary btn-sm toggle-l2-slice-btn'
          ).attr('type', 'button').html(BTN_HIDDEN).click(
            function() {
              let l2_div = $(this).closest('.l2-slice-div');
              let video_div = l2_div.find('.video-div');

              var action_is_show;
              if (video_div.length) {
                action_is_show = video_div.find(':visible').length == 0;
              } else {
                l2_div.append(
                  $('<div>').addClass('video-div').append(init_sample)
                );
                action_is_show = true;
              }

              let l2_div_elems = l2_div.find('.video-div, .more-videos-btn');
              if (action_is_show) {
                l2_div_elems.show();
                $(this).html(BTN_EXPANDED);
              } else {
                l2_div_elems.hide();
                $(this).html(BTN_HIDDEN);
              }
            }
          )
        ] : null,
        // Load lazily if there are 2 levels of slicing
        $('<button>').addClass(
          'btn btn-secondary btn-sm more-videos-btn'
        ).attr('type', 'button').css(
          'display', slice_by_l2 ? 'none' : null
        ).text('more examples').click(
          function() {
            let l2_div = $(this).closest('.l2-slice-div');
            let video_div = l2_div.find('.video-div');
            video_div.append(sampleAndRenderVideos());
            l2_div.find('[name="n-samples-value"]').text(
              video_div.find('.vblock').length
            );
          }
        ),
      ),
      // Load lazily if there are 2 levels of slicing
      slice_by_l2 ? null : $('<div>').addClass('video-div').append(init_sample)
    );
  }

  let non_residual_slices = l2_slices_arr.filter(
    l2_slice => l2_slice[1].length >= min_faces_in_l2_slice
  );
  var residual_slice = null;
  if (l2_slices_arr.length == non_residual_slices.length + 1) {
    // Only one slice is residual
    residual_slice = l2_slices_arr[non_residual_slices.length];
  } else if (l2_slices_arr.length > non_residual_slices.length) {
    // Roll up the remaining slices
    let residual_slice_faces = _.flatMap(l2_slices_arr.slice(non_residual_slices.length),
      ([l2_slice_name, l2_slice_faces]) => l2_slice_faces
    );
    let residual_slice_name = `Residual (${l2_slices_arr.length - non_residual_slices.length} ${slice_by_l2}s)`;
    residual_slice = [residual_slice_name, residual_slice_faces];
  }
  let result = [];
  if (slice_by_l2) {
    result.push($('<div>').addClass('l2-bar-chart-div').append(
      renderBarChart(
        `l2VegaDiv${l1_slice_name}`, residual_slice ?
        non_residual_slices.concat([residual_slice]) : non_residual_slices)
    ));
  }
  non_residual_slices.map(renderL2Slice).forEach(x => result.push(x));
  if (residual_slice) {
    result.push(renderL2Slice(residual_slice));
  }
  return result;
}


function renderBarChart(div_id, faces) {
  let face_count = faces.reduce((acc, x) => acc + x[1].length, 0);
  let slice_times = faces.map(
    ([slice_name, slice_faces], i) => {
      let percent = slice_faces.length/face_count * 100;
      let percent_str = `${percent.toLocaleString(undefined, {maximumFractionDigits: 2})}%`;
      return {
        name: slice_name, 
        value: facesToSeconds(slice_faces)/60, 
        percent: percent_str,
        color: DEFAULT_COLORS[i%DEFAULT_COLORS.length]
      };
    });
  console.log('times', slice_times);
  return $('<div>').addClass('vega-chart').attr('id', div_id).on(
    'render', function() {
      let vega_div = $(this);
      // FIXME: implement this with a bar chart
      console.log('Rendering bar chart');
      //vega_div.text(JSON.stringify(slice_times));
      let vl_spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v4.json",
        width: WIDTH_VEGA_CHART,
        height: HEIGHT_VEGA_CHART,
        data: {
          values: slice_times
        },
        "layer": [{ //add sort & take away string quotes
          "mark": "bar",
          "encoding": {
            "x": {
              "field": "name", "type": "ordinal",
              "axis": {"title": null, "labelAngle": 0},
               sort: {field:"value", op: "count", order:"ascending"} //FIGURE OUT SORT
            },
            "y": {
              "field": "value", "type": "quantitative", "title": "Minutes" 

            },
            "color": {"field": "color", "type": "nominal", "legend": null}
          }
        }, {
          "mark": {
            "type": "text",
            "baseline": "top",
            "dy": -12
          },
          "encoding": {
            "x": {"field": "name", "type": "nominal"},
            "y": {"field": "value", "type": "quantitative"},
            "text": {"field": "percent", "type": "nominal"}
          }
        }]
      };
      vegaEmbed(`#${div_id}`, vl_spec);
    }
  );
}


function render(div_id, faces, slice_by_l1, slice_by_l2, roll_up_percentage,
                crop_faces, start_expanded) {
  $(div_id).empty();
  let n_faces_in_total = faces.length;
  let min_faces_in_l1_slice = roll_up_percentage / 100 * n_faces_in_total;

  // Do the slicing (split into groups by slice_by)
  let l1_slices = sliceFaceList(faces, slice_by_l1);
  let l1_slices_arr = Object.entries(l1_slices).sort(
    sortEntriesByValueListLen
  );

  function renderL1Slice(l1_slice, i) {
    let [l1_slice_name, l1_slice_faces] = l1_slice;
    let l1_slice_seconds = facesToSeconds(l1_slice_faces);
    return $('<div>').addClass('l1-slice-div').css(
      'background-color', convertHex(getColor(i), 0.5)
    ).append(
      $('<div>').addClass('kv-div').append(
        mapKVToJQueryElements(l1_slice_name),
        mapKVToJQueryElements(
          'Screen time',
          `${toDecimal(l1_slice_seconds / 60)} min`
        ),
        mapKVToJQueryElements(
          `Percent of total screen time`,
          `${toDecimal(l1_slice_faces.length / n_faces_in_total * 100)} %`
        ),
        mapKVToJQueryElements(
          'Number of videos',
          getUniqueCountByVideoProperty(l1_slice_faces, 'id')
        ),
        mapKVToJQueryElements(
          'Number of days',
          getUniqueCountByVideoProperty(l1_slice_faces, 'day')
        ),
        $('<button>').addClass(
          'btn btn-secondary btn-sm toggle-l1-slice-btn'
        ).html(BTN_HIDDEN).attr('type', 'button').click(
          function() {
            let l1_div = $(this).closest('.l1-slice-div');
            var l2_divs = l1_div.find('.l2-slice-div');

            var action_is_show;
            if (l2_divs.length) {
              action_is_show = l2_divs.find(':visible').length == 0;
            } else {
              // Lazy loading
              l1_div.append(mapL1SliceToJQueryElements(
                l1_slice_faces, slice_by_l2, roll_up_percentage, crop_faces,
                n_faces_in_total, l1_slice_name))
              action_is_show = true;
            }

            l2_divs = l1_div.find('.l2-slice-div');
            if (action_is_show) {
              l2_divs.show();
              $(this).html(BTN_EXPANDED);
            } else {
              l2_divs.hide();
              $(this).html(BTN_HIDDEN);
            }
          }
        ),
      )
    );
  };

  let non_residual_slices = l1_slices_arr.filter(
    l1_slice => l1_slice[1].length >= min_faces_in_l1_slice
  );
  var residual_slice = null;
  if (l1_slices_arr.length == non_residual_slices.length + 1) {
    // Only one slice is residual
    non_residual_slices.push(l1_slices_arr[non_residual_slices.length]);
  } else if (l1_slices_arr.length > non_residual_slices.length) {
    // Roll up the remaining slices
    let residual_slice_faces = _.flatMap(
      l1_slices_arr.slice(non_residual_slices.length),
      ([l1_slice_name, l1_slice_faces]) => l1_slice_faces
    );
    let residual_slice_name = `Residual (${l1_slices_arr.length - non_residual_slices.length} ${slice_by_l1}s)`;
    residual_slice = [residual_slice_name, residual_slice_faces];
  }

  // Use jquery to write html with videos
  $(div_id).append(
    // Convert slices to JQuery objects for HTML
    $('<div>').addClass('l1-bar-chart-div').append(
      renderBarChart(
        'l1VegaDiv', residual_slice ?
        non_residual_slices.concat([residual_slice]) : non_residual_slices
    )),
    non_residual_slices.map(renderL1Slice),
    residual_slice ?
      renderL1Slice(residual_slice, non_residual_slices.length) : null
  );

  if (start_expanded) {
    $('.toggle-l1-slice-btn').each(function() {
      $(this).click(); // everything is hidden by default
    });
    $('.toggle-l2-slice-btn').each(function() {
      $(this).click(); // everything is hidden by default
    });
  }

  $('.vega-chart').trigger('render');
}

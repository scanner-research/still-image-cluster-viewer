const VIDEO_PATH = 'data/videos.json'
const FACE_PATH_PREFIX = 'data/faces/'

const BTN_EXPANDED = '&#9652;';
const BTN_HIDDEN = '&#9662;';

const DEFAULT_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];


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


function reformatDate(s) {
  return `${s.slice(4, 6)}-${s.slice(6)}-${s.slice(0, 4)}`;
}


function parseVideoName(video_name, width, height, fps) {
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
  return {
    name: video_name,
    channel: channel,
    show: show,
    date: reformatDate(date), // YYYYMMDD FIXME: this is UTC time
    time: time, // hhmmss
    width: width,
    height: height,
    fps: fps
  };
}

function joinFacesWithVideos(videos, faces) {
  let video_dict = {};
  videos.forEach(v => {
    // id, name, width, height, fps
    video_dict[v[0]] = parseVideoName(...v.slice(1));
  });
  return faces.map(face => {
    return {
      id: face.face_id, t: face.t, cluster_id: face.cluster_id,
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


function mapKVToJQueryElements(key, value) {
  return $('<span>').addClass('kv-span').append(
    $('<span>').addClass('key').text(key),
    value ? $('<span>').addClass('value').text(value) : null);
}


const ARCHIVE_ENDPOINT = 'https://ia801301.us.archive.org/0/items';
var FRAME_SERVER_ENDPOINT;
$.get('frameserver.txt', function(data) {
  FRAME_SERVER_ENDPOINT = $.trim(data);
});

const VIDEO_WIDTH = 240;


function mapFaceToJQueryElements(face) {
  let time = face.t / face.video.fps;
  let t0 = Math.max(time - 89, 0);
  let t1 = t0 + 179;
  let play_time = time - t0;
  let resetPlayTime = function() { $(this)[0].currentTime = play_time; };
  let aspectRatio = face.video.width / face.video.height;
  return $('<div>').addClass('vblock').append(
    $('<video controls>').attr({
      preload: 'none', width: VIDEO_WIDTH, height: VIDEO_WIDTH * aspectRatio,
      poster: `${FRAME_SERVER_ENDPOINT}/fetch?path=tvnews/videos/${face.video.name}.mp4&frame=${face.t}`,
      src: `${ARCHIVE_ENDPOINT}/${face.video.name}/${face.video.name}.mp4?start=${t0}&end=${t1}&exact=1&ignore=x.mp4`
    }).on('loadeddata', resetPlayTime).on('pause', resetPlayTime),
    $('<div>').css({
      'max-width': VIDEO_WIDTH, 'font-size': 'x-small'
    }).append(
      $('<span>').css('overflow-x', 'hidden').text(face.video.name),
      $('<span>').text(`timestamp: ${Math.floor(time)}s, face id: ${face.id}`)
    ),
  );
  // FIXME: archive player is imprecise with previews, so we have to use
  // unofficial API
  // return $('<iframe>').prop({
  //   src: `https://archive.org/embed/${face.video.name}?start=${t0}&end=${t1}&exact=1`,
  //   width: 240, height: 160, frameborder: 0,
  //   webkitallowfullscreen: true, mozallowfullscreen: true
  // });
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
  } else if (slice_by == 'channel') {
    slices = faces.reduce(getSliceByVideoPropertyReducer('channel'), {});
  } else if (slice_by == 'show') {
    slices = faces.reduce(getSliceByVideoPropertyReducer('show'), {});
  } else if (slice_by == 'date') {
    slices = faces.reduce(getSliceByVideoPropertyReducer('date'), {});
  }
  return slices;
}


function mapL1SliceToJQueryElements(
  l1_slice_faces, slice_by_l2, n_l2_slices,
  n_faces_in_total, l1_slice_name
) {
  let n_faces_in_l1_slice = l1_slice_faces.length;
  let l2_slices = sliceFaceList(l1_slice_faces, slice_by_l2);
  let l2_slices_arr = Object.entries(l2_slices).sort(
    sortEntriesByValueListLen
  );

  function renderL2Slice(l2_slice) {
    let [l2_slice_name, l2_slice_faces] = l2_slice;
    let l2_slice_seconds = facesToSeconds(l2_slice_faces);

    let samplesPerRow = function() {
      // FIXME: this is hacky and relies on window width and assumptions
      return Math.floor($(window).width() * 0.9 / VIDEO_WIDTH);
    }

    let sampleAndRenderVideos = function() {
      let k = samplesPerRow();
      let sampled_faces = _.sampleSize(l2_slice_faces, k);
      return sampled_faces.map(mapFaceToJQueryElements);
    };

    return $('<div>').addClass('l2-slice-div').append(
      $('<div>').addClass('kv-div').append(
        ...(
          slice_by_l2 ? [
            mapKVToJQueryElements(l2_slice_name),
            mapKVToJQueryElements(
              'Screen time',
              `${toDecimal(l2_slice_seconds / 60)} min`
            ),
            mapKVToJQueryElements(
              `Percent of "${l1_slice_name}"`,
              `${toDecimal(l2_slice_faces.length / n_faces_in_l1_slice * 100)} %`
            ),
            mapKVToJQueryElements(
              'Percent of total',
              `${toDecimal(l2_slice_faces.length / n_faces_in_total * 100)} %`
            ),
            $('<button>').addClass('btn btn-secondary btn-sm toggle-l2-slice-btn').attr('type', 'button').html(BTN_EXPANDED).click(
              function() {
                let l2_div_elems = $(this).closest('.l2-slice-div').find(
                  '.video-div, .more-videos-btn, .fewer-videos-btn'
                );
                if (l2_div_elems.find(':visible').length) {
                  l2_div_elems.hide();
                  $(this).html(BTN_HIDDEN);
                } else {
                  l2_div_elems.show();
                  $(this).html(BTN_EXPANDED);
                }
              }
            )
          ] : []
        ),
        $('<button>').addClass('btn btn-secondary btn-sm more-videos-btn').attr('type', 'button').text('more examples').click(
          function() {
            $(this).closest('.l2-slice-div').find('.video-div').append(
              ...sampleAndRenderVideos()
            );
          }
        ),
        $('<button>').addClass('btn btn-secondary btn-sm fewer-videos-btn').attr('type', 'button').text('fewer examples').click(
          function() {
            let k_to_keep = samplesPerRow();
            $(this).closest('.l2-slice-div').find('.video-div').find('.vblock').each(
              function(i) {
                if (i >= k_to_keep) {
                  $(this).remove()
                };
              }
            );
          }
        ),
      ),
      $('<div>').addClass('video-div').append(...sampleAndRenderVideos())
    );
  }

  let result = l2_slices_arr.slice(0, n_l2_slices).map(renderL2Slice);
  if (l2_slices_arr.length > n_l2_slices) {
    let residual_slice_faces = l2_slices_arr.slice(n_l2_slices).flatMap(
      ([l2_slice_name, l2_slice_faces]) => l2_slice_faces
    );
    let residual_slice_name = `Residual (${l2_slices_arr.length - n_l2_slices} ${slice_by_l2}s)`;
    result.push(renderL2Slice([residual_slice_name, residual_slice_faces]));
  }
  return result;
}


function render(div_id, faces, slice_by_l1, slice_by_l2, n_l1_slices, n_l2_slices, start_expanded) {
  $(div_id).empty();
  let n_faces_in_total = faces.length;

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
          `Percent of total`,
          `${toDecimal(l1_slice_faces.length / n_faces_in_total * 100)} %`
        ),
        $('<button>').addClass('btn btn-secondary btn-sm toggle-l1-slice-btn').html(BTN_EXPANDED).attr('type', 'button').click(
          function() {
            let l2_divs = $(this).closest('.l1-slice-div').find('.l2-slice-div');
            if (l2_divs.find(':visible').length) {
              l2_divs.hide();
              $(this).html(BTN_HIDDEN);
            } else {
              l2_divs.show();
              $(this).html(BTN_EXPANDED);
            }
          }
        ),
      ),
      mapL1SliceToJQueryElements(
        l1_slice_faces, slice_by_l2, n_l2_slices,
        n_faces_in_total, l1_slice_name)
    );
  };

  function renderResidual() {
    let residual_slice_faces = l1_slices_arr.slice(n_l1_slices).flatMap(
      ([l1_slice_name, l1_slice_faces]) => l1_slice_faces
    );
    let residual_slice_name = `Residual (${l1_slices_arr.length - n_l1_slices} ${slice_by_l1}s)`;
    return renderL1Slice([residual_slice_name, residual_slice_faces], n_l1_slices);
  }

  // Use jquery to write html with videos
  $(div_id).append(
    // Convert slices to JQuery objects for HTML
    ...l1_slices_arr.slice(0, n_l1_slices).map(renderL1Slice),
    l1_slices_arr.length <= n_l1_slices ? null : renderResidual()
  );

  if (!start_expanded) {
    $('.toggle-l1-slice-btn').each(function() {
      $(this).click(); // everything is expanded by default
    });
  }
}

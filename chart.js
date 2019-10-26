const VIDEO_PATH_PREFIX = '/videos/'//.json'
const FACE_PATH_PREFIX = '/faces/'

function parseVideoName(video_name) {
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
    date: date, // YYYYMMDD
    time: time  // hhmmss
  };
}

function joinFacesWithVideos(videos, faces) {
  let video_dict = {};
  videos.forEach(v => {
    video_dict[v[0]] = parseVideoName(v[1]); // id and name respectively
  });
  return faces.map(face => {
    return {
      id: face.face_id, t: face.t, cluster_id: face.cluster_id,
      video: video_dict[face.video_id]
    };
  });
}


function init(person_name, callback) {
  jQuery.getJSON(VIDEO_PATH_PREFIX + `${person_name}.json`, function(videos) {
    jQuery.getJSON(FACE_PATH_PREFIX + `${person_name}.json`,
      function(faces) {
        callback(joinFacesWithVideos(videos, faces));
      }
    );
  });
}


const ARCHIVE_ENDPOINT ='https://ia801301.us.archive.org/0/items';


function mapFaceToJQueryElements(face) {
  let t0 = Math.max(face.t - 5, 0);
  let t1 = t0 + 180;
  let curr_time = face.t - t0;
  return $('<div class="vblock" />').append(
    $('<span>').text(`id: ${face.id}`),
    $('<video controls>').prop({
      src: `${ARCHIVE_ENDPOINT}/${face.video.name}/${face.video.name}.mp4?start=${t0}&end=${t1}&exact=1&ignore=x.mp4`,
    }).attr({width: 240, height: 160}).on('loadeddata', function() {
      $(this)[0].currentTime = curr_time;
    })
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
  return a[1].length - b[1].length;
}


function mapSliceToJQueryElements(faces, n_clusters, k_samples_per_cluster) {
  let faces_by_cluster = {};
  faces.forEach(f => {
    let cluster_id = f.cluster_id;
    if (!faces_by_cluster.hasOwnProperty(cluster_id)) {
      faces_by_cluster[cluster_id] = [f];
    } else {
      faces_by_cluster[cluster_id].push(f);
    }
  });

  let faces_by_cluster_arr = Object.entries(
    faces_by_cluster
  ).sort(sortEntriesByValueListLen);

  return faces_by_cluster_arr.slice(0, n_clusters).map(
    ([cluster_id, cluster_faces]) => {
      let sampled_faces = _.sampleSize(cluster_faces, k_samples_per_cluster);
      return $('<div>').append(
        $('<h3>').text(`cluster ${cluster_id} - ${cluster_faces.length * 3}s`),
        $('<div>').append(...sampled_faces.map(mapFaceToJQueryElements))
      );
    }
  );
}


// TODO: make this an argument that can be set by a html input
const N_SLICES_TO_SHOW = 10;


function render(div_id, faces, slice_by) {
  $(div_id).empty();
  console.log('Slicing by:', slice_by ? slice_by : 'none');

  // Do the slicing (split into groups by slice_by)
  let slices = {'all': faces};

  // Might want to drop some groups
  // - sort by total time
  // - count total amount of time (normalization constants) before dropping

  // Use jquery to write html with videos

  $(div_id).append(
    // Convert slices to JQuery objects for HTML
    ...Object.entries(slices).sort(
      sortEntriesByValueListLen
    ).slice(0, N_SLICES_TO_SHOW).map(
      ([slice_name, slice_faces]) => {
        return $('<div>').append(
          $('<h1>').text(slice_name),
          mapSliceToJQueryElements(faces, 3, 10)
        );
      }
    )
  );
}
